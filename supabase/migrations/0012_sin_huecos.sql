-- 0012 · Un día sin marcar reinicia el reto. Se acabaron los huecos.
--
-- 0010 convirtió el día sin marcar en un hueco que pausaba la racha y se podía
-- contestar durante una semana. En la práctica dejó de importar abrir la app:
-- si mañana te pregunta, hoy da igual. Y un reto que se puede cumplir sin
-- entrar cada día no obliga a nada.
--
-- Regla nueva, en dos líneas:
--   1. Cada día que toca se marca ese día. Si a medianoche no está marcado,
--      el reto vuelve a cero, igual que con una recaída (0011).
--   2. Hoy no cuenta hasta que termina: sin marcar a las ocho de la mañana no
--      es una falta, es que todavía no ha pasado el día.
--
-- Lo que NO cambia: los días que no tocan siguen sin contar (quien va al
-- gimnasio lunes, miércoles y viernes no pierde nada el martes); el
-- cumplimiento sigue midiendo el esfuerzo entero; el calendario lo guarda todo.
--
-- Se va `huecos_pendientes` y la columna `pendientes` de `get_daily_overview`:
-- ya no hay nada que preguntar después.

-- ---------------------------------------------------------------------------
-- 1. Estadísticas: los días del reto son la tira de días seguidos que tocaban
-- ---------------------------------------------------------------------------

-- Misma firma que 0010 y 0011. Vuelve la aritmética de "islas" de 0007, pero
-- más simple: ya no hay política que perdone recaídas.
--
-- A cada día limpio se le pone su número de orden entre los días que tocan
-- (`dias_que_tocan_hasta`, de 0006). Dos días limpios seguidos de los que
-- tocan tienen números consecutivos; si entre ellos falta uno o hay una
-- recaída, el orden salta y la isla se parte. El reto en curso es la isla que
-- termina en el último día que tocaba hasta el cierre, y el cierre es hoy si
-- hoy ya está marcado, o ayer si no.
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
    select active_dows, start_date
    from habits where id = p_habit_id
  ),
  logs as (
    select log_date, status
    from habit_logs
    where habit_id = p_habit_id
      and log_date <= p_today
  ),
  -- Solo los limpios de días que tocaban: marcar "igual" un día libre no
  -- avanza el reto, que se cuenta sobre los días que se propuso.
  limpios as (
    select public.dias_que_tocan_hasta(h.active_dows, l.log_date) as pos
    from logs l
    cross join h
    where l.status = 'success'
      and extract(dow from l.log_date)::smallint = any (h.active_dows)
  ),
  islas as (
    select pos, pos - (row_number() over (order by pos))::integer as isla
    from limpios
  ),
  tramos as (
    select isla, count(*)::integer as largo, max(pos) as fin
    from islas
    group by isla
  ),
  -- El cierre: el último día que ya terminó, o hoy si hoy ya está marcado.
  cierre as (
    select case
      when exists (select 1 from logs where log_date = p_today) then p_today
      else p_today - 1
    end as dia
  ),
  ultimo as (
    select public.dias_que_tocan_hasta(h.active_dows, c.dia) as pos
    from h cross join cierre c
  ),
  en_curso as (
    select coalesce(
      (select t.largo from tramos t, ultimo u where t.fin = u.pos),
      0
    ) as limpios
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
      count(*) filter (where status = 'success')::integer as limpios_totales,
      count(*) filter (where status = 'relapse')::integer as relapses
    from logs
  )
  select
    c.limpios,
    t.relapses,
    case
      when e.total = 0 then 0
      else least(100, round(t.limpios_totales::numeric * 100 / e.total))::integer
    end,
    c.limpios,
    coalesce((select max(largo) from tramos), 0)
  from totales t
  cross join esperados e
  cross join en_curso c;
$$;

comment on function public.get_habit_stats(uuid, date) is
  'Días del reto (seguidos, de los que tocaban, hasta el último día cerrado),
   recaídas, cumplimiento sobre los días que tocaban desde el inicio, racha y
   mejor racha. Una recaída o un día sin marcar reinician el reto. p_today es
   el día local de la persona.';

-- ---------------------------------------------------------------------------
-- 2. Lo que lee Hoy, sin la lista de huecos
-- ---------------------------------------------------------------------------

drop function if exists public.get_daily_overview(date);
drop function if exists public.huecos_pendientes(uuid, date);

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

comment on function public.get_daily_overview(date) is
  'Los hábitos activos de quien pregunta, con si hoy toca, el estado de hoy, el
   porqué y las estadísticas. p_date es el día local de la persona.';

-- ---------------------------------------------------------------------------
-- 3. El aviso de la noche: cuántos hábitos siguen sin marcar hoy
-- ---------------------------------------------------------------------------

-- Misma función que 0010 sin la cuenta de huecos. El `dato` del aviso `dia`
-- pasa a ser cuántos hábitos que tocaban hoy siguen sin marcar: es lo que
-- está en juego a medianoche.
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

    select a.id, 'dia', a.hoy, null,
      (select count(*)::integer from sin_marcar s where s.id = a.id), 4
    from ahora a
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
