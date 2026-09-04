-- Recordatorios.
--
-- Nadie abre una app para acordarse de algo: la app se lo recuerda. Sin esto,
-- Antídoto depende de que la persona se acuerde sola, que es justo lo que no
-- funciona los días malos.
--
-- Cuatro avisos y ni uno más, como mucho uno al día, apagados de fábrica. Lo
-- que NO hay es el "te echamos de menos, llevas cinco días sin entrar": le
-- llegaría a alguien que probablemente está teniendo una mala semana y le
-- sumaría culpa desde el teléfono. Toda la app está construida sobre no
-- castigar; ese aviso castiga.

-- ---------------------------------------------------------------------------
-- Dónde se manda
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- La URL que da el navegador. Es única en el mundo y es la identidad del
  -- dispositivo: la misma persona en el teléfono y en el portátil son dos
  -- filas, y las dos reciben.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,

  -- Para poder decirle a alguien "estás recibiendo en 2 dispositivos" sin
  -- enseñarle una URL de 300 caracteres.
  user_agent text,

  created_at timestamptz not null default now()
);

comment on table public.push_subscriptions is
  'Un dispositivo suscrito a recordatorios. El endpoint lo da el navegador y es
   a la vez la dirección y la identidad del aparato.';

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push: leer las propias" on public.push_subscriptions;
create policy "push: leer las propias" on public.push_subscriptions
  for select using ((select auth.uid()) = user_id);

drop policy if exists "push: crear las propias" on public.push_subscriptions;
create policy "push: crear las propias" on public.push_subscriptions
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "push: borrar las propias" on public.push_subscriptions;
create policy "push: borrar las propias" on public.push_subscriptions
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Qué quiere recibir cada quien
-- ---------------------------------------------------------------------------

alter table public.profiles
  -- A qué hora quiere el recordatorio del día, en SU hora. Nulo = apagado.
  -- Nulo por defecto y no un 21 cualquiera: encender avisos es una decisión de
  -- quien los recibe, no algo que se hereda por registrarse.
  add column if not exists reminder_hour smallint,
  add column if not exists avisa_racha boolean not null default true,
  add column if not exists avisa_hito boolean not null default true,
  add column if not exists avisa_hora_dificil boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_reminder_hour_check;
alter table public.profiles
  add constraint profiles_reminder_hour_check
  check (reminder_hour is null or reminder_hour between 0 and 23);

comment on column public.profiles.reminder_hour is
  'Hora local a la que se manda el recordatorio del día. Nulo = sin avisos.';

-- ---------------------------------------------------------------------------
-- Uno al día, y que conste
-- ---------------------------------------------------------------------------

-- La llave primaria es (user_id, local_date), así que el tope de un aviso al
-- día lo impone el esquema y no el cuidado de quien escriba el código de
-- envío. Una app que trata adicciones no puede permitirse una tormenta de
-- notificaciones por un bucle mal escrito.
create table if not exists public.notification_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  kind text not null check (kind in ('dia', 'racha', 'hito', 'hora_dificil')),
  sent_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

comment on table public.notification_log is
  'Qué aviso recibió cada quien cada día. La llave primaria es lo que impide
   mandar más de uno al día.';

alter table public.notification_log enable row level security;

drop policy if exists "avisos: leer los propios" on public.notification_log;
create policy "avisos: leer los propios" on public.notification_log
  for select using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- A quién le toca aviso ahora mismo
-- ---------------------------------------------------------------------------

-- Devuelve, para el instante en que se la llame, quién debe recibir qué.
--
-- Toda la decisión vive aquí y no en el código de envío por una razón: la hora
-- de cada persona sale de su zona horaria, y esa es la regla que no se rompe en
-- esta app. Calcularlo en SQL con `timezone(p.timezone, now())` lo deja al lado
-- del dato, en vez de repartido por un cliente que puede estar en Virginia.
--
-- Como mucho una fila por persona: `distinct on` con el orden de prioridad
-- decide cuál, y el aviso más útil gana. La hora difícil primero porque llega
-- ANTES de que pase algo; el resto son recordatorios de algo ya ocurrido.
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
  /*
   * El candado que no depende de los permisos.
   *
   * Abajo hay un `revoke` para que nadie con sesión pueda ejecutarla, pero un
   * `grant execute on all functions in schema public` posterior —de una
   * migración, de un script de permisos, de cualquiera— lo deshace sin avisar.
   * Lo descubrimos porque el harness de pruebas hace exactamente eso, y el caso
   * pasó de verde a rojo.
   *
   * Esta función devuelve los avisos de TODO EL MUNDO. Un permiso mal puesto
   * aquí es una fuga de la lista entera de usuarios, sus horarios y sus
   * hábitos. Así que además del permiso: el enviador llama con la clave de
   * servicio, donde no hay usuario; cualquier llamada con sesión se corta aquí.
   */
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
      -- Sin un solo dispositivo suscrito no hay a dónde mandar nada.
      and exists (select 1 from push_subscriptions s where s.user_id = p.id)
  ),
  -- Los hábitos activos que hoy tocaban y siguen sin marcar.
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
    -- 1. La hora difícil. Una hora antes del bloque de cuatro en el que más
    --    veces le ha dado, y solo el día de la semana en que le da. Solo se
    --    dispara con muestra suficiente: con cuatro registros cualquier patrón
    --    es ruido.
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

    -- 2. Una racha en riesgo. Tarde, y solo si hay algo que perder: avisar a
    --    quien lleva un día es ruido; a quien lleva doce, es un favor.
    select a.id, 'racha', a.hoy, s.name, e.current_streak, 2
    from ahora a
    join sin_marcar s on s.id = a.id
    cross join lateral public.get_habit_stats(s.habit_id, a.hoy) e
    where a.avisa_racha
      and a.hora = 22
      and e.current_streak >= 3

    union all

    -- 3. Un hito a la vista, la víspera. Una sola vez, no cada día.
    select a.id, 'hito', a.hoy, h.name, (h.target_days - e.clean_days), 3
    from ahora a
    join habits h on h.user_id = a.id and h.status = 'active'
    cross join lateral public.get_habit_stats(h.id, a.hoy) e
    where a.avisa_hito
      and a.hora = a.reminder_hour
      and h.target_days - e.clean_days = 1

    union all

    -- 4. Cerrar el día. El de base: a la hora que eligió, si queda algo sin
    --    marcar o no ha contado cómo le fue.
    select a.id, 'dia', a.hoy, null, 0, 4
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
  -- Y nunca dos veces el mismo día. El tope lo impone también la llave
  -- primaria de notification_log; esto solo evita el viaje de ida.
  where not exists (
    select 1 from notification_log n
    where n.user_id = c.user_id and n.local_date = c.local_date
  )
  order by c.user_id, c.prioridad;
end;
$$;

comment on function public.avisos_pendientes is
  'Quién debe recibir qué aviso en este instante, uno por persona como mucho.
   SECURITY DEFINER porque la llama el enviador con la clave de servicio: no
   está pensada para que la llame nadie con sesión.';

-- Nadie con sesión normal debe poder preguntar por los avisos de todo el
-- mundo. La función es SECURITY DEFINER, así que el permiso es el candado.
revoke all on function public.avisos_pendientes() from public, anon, authenticated;
