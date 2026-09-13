-- 0013 · El premio del reto, y dos avisos al día a horas fijas.
--
-- El premio: al crear el reto, lo que la persona se da si lo cumple ("una
-- cena en ese restaurante"). Es una columna de texto y nada más: si está
-- abierto o cerrado lo decide la pantalla comparando los días del reto con la
-- meta, así que al reiniciar el reto (0011, 0012) el premio se vuelve a
-- cerrar solo, sin columna de estado que pueda quedarse desfasada.
--
-- Los avisos: hasta aquí, uno al día a la hora que cada quien eligiera. Con la
-- regla de 0012 (un día sin marcar reinicia el reto) el aviso que importa es
-- el de la noche, y elegir hora era una decisión rara para algo que solo
-- tiene una hora buena. Ahora son dos, fijos:
--   - a las 9, uno que recuerda el reto: cuántos días lleva y su porqué;
--   - a las 21, uno que dice lo que está en juego si sigue sin marcar, o
--     pide la bitácora si ya marcó todo.
-- Y la hora difícil sigue aparte, cuando hay patrón. Cada aviso tiene su
-- franja y la llave primaria de `notification_log` deja pasar uno por franja
-- y día. `reminder_hour` se queda solo como interruptor: nulo es apagados.

-- ---------------------------------------------------------------------------
-- 1. El premio
-- ---------------------------------------------------------------------------

alter table public.habits
  add column if not exists reward text check (length(reward) <= 200);

comment on column public.habits.reward is
  'Lo que la persona se da si cumple el reto. Opcional. Se enseña bajo llave
   hasta que los días del reto llegan a la meta; la pantalla lo decide.';

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
  premio         text,
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
    h.reward,
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
   porqué, el premio y las estadísticas. p_date es el día local de la persona.';

-- ---------------------------------------------------------------------------
-- 2. Dos franjas de aviso
-- ---------------------------------------------------------------------------

alter table public.notification_log
  add column if not exists slot text not null default 'noche'
    check (slot in ('manana', 'noche', 'impulso'));

alter table public.notification_log drop constraint if exists notification_log_kind_check;
alter table public.notification_log
  add constraint notification_log_kind_check
  check (kind in ('manana', 'noche', 'dia', 'racha', 'hito', 'hora_dificil'));

alter table public.notification_log drop constraint if exists notification_log_pkey;
alter table public.notification_log add primary key (user_id, local_date, slot);

comment on table public.notification_log is
  'Qué aviso recibió cada quien cada día y en qué franja. La llave primaria
   deja pasar uno por franja y día: el de la mañana, el de la noche y, si hay
   patrón, el de la hora difícil.';

comment on column public.profiles.reminder_hour is
  'Interruptor de los avisos: nulo es apagados. Desde 0013 las horas son
   fijas (9 y 21) y el valor guardado ya no se lee.';

-- ---------------------------------------------------------------------------
-- 3. A quién le toca aviso ahora mismo
-- ---------------------------------------------------------------------------

-- Cambia el tipo de retorno (slot y extra), así que se tira y se vuelve a crear.
drop function if exists public.avisos_pendientes();

create or replace function public.avisos_pendientes()
returns table (
  user_id uuid,
  kind text,
  slot text,
  local_date date,
  habito text,
  dato integer,
  extra text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hora_manana constant smallint := 9;
  hora_noche  constant smallint := 21;
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
      p.avisa_hito,
      p.avisa_hora_dificil,
      (timezone(p.timezone, now()))::date        as hoy,
      extract(hour from timezone(p.timezone, now()))::smallint as hora,
      extract(dow  from timezone(p.timezone, now()))::smallint as dow
    from profiles p
    where p.reminder_hour is not null
      and exists (select 1 from push_subscriptions s where s.user_id = p.id)
  ),
  -- Los hábitos que tocan hoy, con sus números.
  de_hoy as (
    select a.id, h.id as habit_id, h.name, h.description, e.current_streak,
           exists (
             select 1 from habit_logs l
             where l.habit_id = h.id and l.log_date = a.hoy
           ) as marcado
    from ahora a
    join habits h on h.user_id = a.id and h.status = 'active'
    cross join lateral public.get_habit_stats(h.id, a.hoy) e
    where extract(dow from a.hoy)::smallint = any (h.active_dows)
  ),
  candidatos as (
    -- La mañana: el reto con más racha, para recordar por dónde va. Entre
    -- paréntesis porque un miembro de un union no puede llevar order by suelto.
    (
      select distinct on (d.id)
        d.id as user_id,
        'manana'::text as kind,
        'manana'::text as slot,
        a.hoy as local_date,
        d.name as habito,
        d.current_streak as dato,
        d.description as extra,
        1 as prioridad
      from ahora a
      join de_hoy d on d.id = a.id
      where a.hora = hora_manana
      order by d.id, d.current_streak desc, d.name
    )

    union all

    select
      a.id, 'hora_dificil', 'impulso', a.hoy, null, r.total::integer, null, 1
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

    -- La noche, en orden: la víspera de la meta, lo que sigue sin marcar, y
    -- si todo está marcado, la bitácora.
    select a.id, 'hito', 'noche', a.hoy, h.name, (h.target_days - e.clean_days), null, 1
    from ahora a
    join habits h on h.user_id = a.id and h.status = 'active'
    cross join lateral public.get_habit_stats(h.id, a.hoy) e
    where a.avisa_hito
      and a.hora = hora_noche
      and h.target_days - e.clean_days = 1

    union all

    select a.id, 'noche', 'noche', a.hoy, null,
      (select count(*)::integer from de_hoy d where d.id = a.id and not d.marcado),
      null, 2
    from ahora a
    where a.hora = hora_noche
      and exists (select 1 from de_hoy d where d.id = a.id and not d.marcado)

    union all

    select a.id, 'dia', 'noche', a.hoy, null, 0, null, 3
    from ahora a
    where a.hora = hora_noche
      and not exists (select 1 from de_hoy d where d.id = a.id and not d.marcado)
      and not exists (
        select 1 from journal_entries j
        where j.user_id = a.id and j.entry_date = a.hoy
      )
  )
  select distinct on (c.user_id, c.slot)
    c.user_id, c.kind, c.slot, c.local_date, c.habito, c.dato, c.extra
  from candidatos c
  where not exists (
    select 1 from notification_log n
    where n.user_id = c.user_id and n.local_date = c.local_date and n.slot = c.slot
  )
  order by c.user_id, c.slot, c.prioridad;
end;
$$;

comment on function public.avisos_pendientes() is
  'A quién le toca aviso en este instante y cuál, una fila por persona y
   franja: la mañana (9), la noche (21) y la hora difícil. Solo para el
   enviador con la clave de servicio: con sesión de usuario se niega.';

revoke all on function public.avisos_pendientes() from public, anon, authenticated;
