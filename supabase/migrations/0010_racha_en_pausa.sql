-- La racha ya no se rompe por un día sin marcar. Se pausa.
--
-- Antes, olvidar abrir la app un martes dejaba la racha en cero el miércoles
-- —aunque ese martes no hubiera pasado nada— mientras que una recaída
-- registrada con "sigo contando" se perdonaba. Castigaba más el olvido que la
-- recaída, que es lo contrario de lo que promete la app.
--
-- Regla nueva, en tres líneas:
--   1. Un día sin marcar es un hueco: ni suma ni resta. La racha se queda con
--      el número que tenía.
--   2. Lo único que rompe la racha es una recaída, y solo con "vuelvo a
--      empezar de cero".
--   3. Los huecos cuestan: no avanzan la meta, bajan el cumplimiento y salen
--      grises. Se pueden contestar durante siete días; después se quedan.
--
-- Y el "por qué": una frase opcional por hábito, que la app enseña justo
-- cuando hace falta —en el impulso y después de una caída—.

-- ---------------------------------------------------------------------------
-- 1. El "por qué" vive en la columna que ya existía y nadie usaba
-- ---------------------------------------------------------------------------

comment on column public.habits.description is
  'Para qué lo hace: la frase que la persona escribió al crear el hábito. Se
   enseña en la hoja del impulso y después de una recaída. Opcional.';

-- ---------------------------------------------------------------------------
-- 2. Los huecos: qué días tocaban y quedaron sin registro
-- ---------------------------------------------------------------------------

-- Los últimos siete días, de más viejo a más nuevo, en que tocaba y no hay
-- registro. Hoy no cuenta: el día no ha terminado. Antes de `start_date`
-- tampoco: el reto aún no existía.
create or replace function public.huecos_pendientes(p_habit_id uuid, p_today date)
returns date[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(d::date order by d), '{}'::date[])
  from habits h
  cross join lateral generate_series(
    greatest(h.start_date, p_today - 7),
    p_today - 1,
    interval '1 day'
  ) as d
  where h.id = p_habit_id
    and extract(dow from d)::smallint = any (h.active_dows)
    and not exists (
      select 1 from habit_logs l
      where l.habit_id = h.id and l.log_date = d::date
    )
$$;

comment on function public.huecos_pendientes is
  'Días de los últimos siete que tocaban y siguen sin registro. Es lo que la
   pantalla de Hoy pregunta uno a uno.';

-- ---------------------------------------------------------------------------
-- 3. Las estadísticas con la regla nueva
-- ---------------------------------------------------------------------------

-- Se va la aritmética de islas y posiciones de 0007: ya no hace falta saber
-- si dos días marcados son consecutivos, porque un hueco entre ellos no los
-- separa. Lo que separa es una recaída con política "reset".
--
-- `completion_rate` y `esperados` no cambian: ahí un hueco sigue siendo un día
-- que tocaba y no se hizo. Esa es la parte de "los huecos cuestan".
create or replace function public.get_habit_stats(p_habit_id uuid, p_today date)
returns table (
  clean_days      integer,
  relapses        integer,
  completion_rate integer,
  current_streak  integer,
  best_streak     integer
)
language sql
stable
set search_path = public
as $$
  with h as (
    select active_dows, relapse_policy, start_date
    from habits where id = p_habit_id
  ),
  logs as (
    select log_date, status
    from habit_logs
    where habit_id = p_habit_id
      and log_date <= p_today
  ),
  -- Cada registro con cuántas recaídas hubo antes o el mismo día: eso parte
  -- la secuencia en tramos. Con "sigo contando" todo es un solo tramo.
  tramos as (
    select
      l.log_date,
      l.status,
      case
        when (select relapse_policy from h) = 'reset'
        then (select count(*) from logs r
              where r.status = 'relapse' and r.log_date <= l.log_date)
        else 0
      end as tramo
    from logs l
  ),
  por_tramo as (
    select tramo, count(*) filter (where status = 'success')::integer as limpios
    from tramos
    group by tramo
  ),
  ultimo as (
    select coalesce(max(tramo), 0) as tramo from tramos
  ),
  esperados as (
    select greatest(
      0,
      public.dias_que_tocan_hasta(h.active_dows, p_today)
        - public.dias_que_tocan_hasta(h.active_dows, h.start_date - 1)
        - case
            when extract(dow from p_today)::smallint = any (h.active_dows)
                 and not exists (select 1 from logs where log_date = p_today)
            then 1 else 0
          end
    ) as total
    from h
  ),
  totales as (
    select
      count(*) filter (where status = 'success')::integer as clean_days,
      count(*) filter (where status = 'relapse')::integer as relapses
    from logs
  )
  select
    t.clean_days,
    t.relapses,
    case
      when e.total = 0 then 0
      else least(100, round(t.clean_days::numeric * 100 / e.total))::integer
    end,
    -- La racha: los limpios del tramo en curso, que es el que va después de
    -- la última recaída. Sin recaídas (o con "sigo contando"), todos.
    coalesce(
      (select p.limpios from por_tramo p where p.tramo = (select tramo from ultimo)),
      0
    ),
    coalesce((select max(p.limpios) from por_tramo p), 0)
  from totales t
  cross join esperados e;
$$;

-- ---------------------------------------------------------------------------
-- 4. Lo que lee Hoy: ahora con el "por qué" y los huecos
-- ---------------------------------------------------------------------------

-- Cambia el tipo de retorno, así que se tira y se vuelve a crear. `today_note`
-- se va: nada la leía.
drop function if exists public.get_daily_overview(date);

create or replace function public.get_daily_overview(p_date date)
returns table (
  habit_id       uuid,
  name           text,
  kind           text,
  icon           text,
  color          text,
  target_days    integer,
  start_date     date,
  relapse_policy text,
  active_dows    smallint[],
  toca_hoy       boolean,
  today_status   text,
  motivo         text,
  pendientes     date[],
  clean_days     integer,
  current_streak integer,
  best_streak    integer
)
language sql
stable
set search_path = public
as $$
  select
    h.id,
    h.name,
    h.kind,
    h.icon,
    h.color,
    h.target_days,
    h.start_date,
    h.relapse_policy,
    h.active_dows,
    extract(dow from p_date)::smallint = any (h.active_dows),
    l.status,
    h.description,
    public.huecos_pendientes(h.id, p_date),
    s.clean_days,
    s.current_streak,
    s.best_streak
  from habits h
  left join habit_logs l on l.habit_id = h.id and l.log_date = p_date
  cross join lateral public.get_habit_stats(h.id, p_date) s
  where h.user_id = (select auth.uid())
    and h.status = 'active'
  order by h.created_at;
$$;

-- ---------------------------------------------------------------------------
-- 5. El aviso de la noche sabe si hay huecos
-- ---------------------------------------------------------------------------

-- Misma función que en 0008; lo único que cambia es el `dato` del aviso
-- `dia`: cuántos huecos sin contestar hay, para que el texto pueda decir
-- "ayer quedó sin marcar" en vez del genérico.
create or replace function public.avisos_pendientes()
returns table (
  user_id uuid,
  kind text,
  local_date date,
  habito text,
  dato integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is not null then
    raise exception 'avisos_pendientes: reservada al enviador'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  with ahora as (
    select
      p.id,
      p.timezone,
      p.reminder_hour,
      p.avisa_racha,
      p.avisa_hito,
      p.avisa_hora_dificil,
      (timezone(p.timezone, now()))::date        as hoy,
      extract(hour from timezone(p.timezone, now()))::smallint as hora,
      extract(dow  from timezone(p.timezone, now()))::smallint as dow
    from profiles p
    where p.reminder_hour is not null
      and exists (select 1 from push_subscriptions s where s.user_id = p.id)
  ),
  sin_marcar as (
    select a.id, h.name, h.id as habit_id
    from ahora a
    join habits h on h.user_id = a.id and h.status = 'active'
    where extract(dow from a.hoy)::smallint = any (h.active_dows)
      and not exists (
        select 1 from habit_logs l
        where l.habit_id = h.id and l.log_date = a.hoy
      )
  ),
  -- Cuántos huecos de los últimos siete días tiene cada quien, sumando todos
  -- sus hábitos.
  huecos as (
    select a.id, sum(cardinality(public.huecos_pendientes(h.id, a.hoy)))::integer as total
    from ahora a
    join habits h on h.user_id = a.id and h.status = 'active'
    group by a.id
  ),
  candidatos as (
    select
      a.id as user_id,
      'hora_dificil'::text as kind,
      a.hoy as local_date,
      null::text as habito,
      r.total::integer as dato,
      1 as prioridad
    from ahora a
    cross join lateral (
      select
        c.local_dow,
        (c.local_hour / 4)::smallint as bloque,
        count(*)::bigint as total
      from cravings c
      where c.user_id = a.id
        and c.local_date >= a.hoy - 90
      group by 1, 2
      order by count(*) desc, 1, 2
      limit 1
    ) r
    where a.avisa_hora_dificil
      and r.total >= 8
      and r.local_dow = a.dow
      and a.hora = greatest(0, r.bloque * 4 - 1)

    union all

    select a.id, 'racha', a.hoy, s.name, e.current_streak, 2
    from ahora a
    join sin_marcar s on s.id = a.id
    cross join lateral public.get_habit_stats(s.habit_id, a.hoy) e
    where a.avisa_racha
      and a.hora = 22
      and e.current_streak >= 3

    union all

    select a.id, 'hito', a.hoy, h.name, (h.target_days - e.clean_days), 3
    from ahora a
    join habits h on h.user_id = a.id and h.status = 'active'
    cross join lateral public.get_habit_stats(h.id, a.hoy) e
    where a.avisa_hito
      and a.hora = a.reminder_hour
      and h.target_days - e.clean_days = 1

    union all

    select a.id, 'dia', a.hoy, null, coalesce(u.total, 0), 4
    from ahora a
    left join huecos u on u.id = a.id
    where a.hora = a.reminder_hour
      and (
        exists (select 1 from sin_marcar s where s.id = a.id)
        or not exists (
          select 1 from journal_entries j
          where j.user_id = a.id and j.entry_date = a.hoy
        )
      )
  )
  select distinct on (c.user_id)
    c.user_id, c.kind, c.local_date, c.habito, c.dato
  from candidatos c
  where not exists (
    select 1 from notification_log n
    where n.user_id = c.user_id and n.local_date = c.local_date
  )
  order by c.user_id, c.prioridad;
end;
$$;

revoke all on function public.avisos_pendientes() from public, anon, authenticated;
