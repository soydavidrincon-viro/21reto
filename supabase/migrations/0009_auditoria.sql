-- Lo que salió de la auditoría del esquema. Seis cosas, cada una con su
-- razón; ninguna cambia lo que la app enseña, todas cambian lo que puede
-- romperse o lo que se calculaba dos veces.

-- ---------------------------------------------------------------------------
-- 1. Volver a activar los avisos en el mismo navegador fallaba
-- ---------------------------------------------------------------------------

-- La app guarda el dispositivo con un upsert sobre `endpoint`: si el navegador
-- devuelve la misma suscripción que ya tenía, la fila se actualiza en vez de
-- duplicarse. Pero la tabla solo tenía políticas de leer, crear y borrar. Sin
-- política UPDATE, la rama "ya existe, actualízala" del upsert es un 42501 —
-- y eso es lo que veía quien apagaba los avisos en un dispositivo y los volvía
-- a encender en otro donde la suscripción seguía viva.
--
-- Las dos cláusulas son obligatorias y no una cortesía. El endpoint es único
-- en el mundo, así que sin `using` cualquiera podría hacer upsert sobre el
-- endpoint de otra persona, quedarse con la fila y recibir SUS avisos — que
-- llevan el nombre de sus hábitos. `using` dice qué filas puedes tocar: solo
-- las tuyas. `with check` dice cómo pueden quedar: solo tuyas.
drop policy if exists "push: actualizar las propias" on public.push_subscriptions;
create policy "push: actualizar las propias" on public.push_subscriptions
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 2. Una zona horaria inválida no puede entrar
-- ---------------------------------------------------------------------------

-- `profiles.timezone` era texto libre. Con "Marte/Olympus" guardado, todo lo
-- que calcula "qué día es hoy" para esa persona revienta — y no solo lo suyo:
-- `avisos_pendientes()` recorre TODOS los perfiles con `timezone(p.timezone,
-- now())`, así que un solo perfil malo dejaba sin recordatorios a todo el
-- mundo, cada hora, sin un error visible en ningún sitio.
--
-- Se valida con la misma función que después la usa: si Postgres no puede
-- resolverla, no se guarda. Va en un trigger y no en un CHECK porque un CHECK
-- no puede llamar a algo que depende de la zona horaria de sesión sin que
-- Postgres se queje de que no es IMMUTABLE.
create or replace function public.validar_timezone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.timezone is null or btrim(new.timezone) = '' then
    raise exception 'timezone vacía' using errcode = 'invalid_parameter_value';
  end if;

  begin
    perform timezone(new.timezone, now());
  exception
    when others then
      raise exception 'timezone desconocida: %', new.timezone
        using errcode = 'invalid_parameter_value';
  end;

  return new;
end;
$$;

drop trigger if exists profiles_validar_timezone on public.profiles;
create trigger profiles_validar_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validar_timezone();

revoke all on function public.validar_timezone() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Un registro con fecha futura no puede inflar la racha
-- ---------------------------------------------------------------------------

-- `get_habit_stats` leía todos los registros del hábito sin mirar la fecha.
-- Con un "limpio" puesto en 2099, la racha, la mejor racha y los días limpios
-- lo contaban. Solo se lo podía hacer uno a sí mismo, pero también engañaba al
-- aviso de "mañana llegas a tu meta". Ahora solo cuenta hasta `p_today`, que
-- es la única fecha que la app considera real.
--
-- Misma función que en 0007, con un `and log_date <= p_today` en `logs`.
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
  posiciones as (
    select
      l.log_date,
      l.status,
      public.dias_que_tocan_hasta((select active_dows from h), l.log_date)
        - case
            when (select relapse_policy from h) = 'continue'
            then public.recaidas_hasta(p_habit_id, l.log_date)
            else 0
          end as pos
    from logs l
  ),
  islas as (
    select
      log_date,
      pos,
      pos - (row_number() over (order by log_date))::integer as isla
    from posiciones
    where status = 'success'
  ),
  runs as (
    select isla, count(*)::integer as largo, max(pos) as termina_en
    from islas
    group by isla
  ),
  hoy as (
    select
      public.dias_que_tocan_hasta((select active_dows from h), p_today)
        - case
            when (select relapse_policy from h) = 'continue'
            then public.recaidas_hasta(p_habit_id, p_today)
            else 0
          end as pos
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
    coalesce(
      (
        select r.largo
        from runs r
        where r.termina_en >= (select pos from hoy) - 1
        order by r.termina_en desc
        limit 1
      ),
      0
    ),
    coalesce((select max(r.largo) from runs r), 0)
  from totales t
  cross join esperados e;
$$;

-- ---------------------------------------------------------------------------
-- 4. Dos índices que faltaban
-- ---------------------------------------------------------------------------

-- Borrar un hábito borra sus impulsos en cascada, y para eso Postgres busca
-- por `habit_id`. Ningún índice de cravings empezaba por esa columna, así que
-- cada borrado recorría la tabla entera.
create index if not exists cravings_habit_idx
  on public.cravings (habit_id);

-- `avisos_pendientes` arranca filtrando a quien tiene hora puesta. Con un
-- índice parcial solo se recorren esos, no todos los perfiles cada hora.
create index if not exists profiles_reminder_idx
  on public.profiles (reminder_hour)
  where reminder_hour is not null;

-- ---------------------------------------------------------------------------
-- 5. El bucket de fotos ya no se puede listar sin sesión
-- ---------------------------------------------------------------------------

-- El bucket es público para que la foto cargue con una URL directa, y eso
-- sigue igual. Lo que sobraba era la política de lectura sin `to`: valía para
-- `anon`, y con la llave pública cualquiera podía LISTAR el bucket y sacar el
-- uuid de todo el que tiene foto. Listar y servir son permisos distintos: el
-- segundo lo da el bucket público; el primero, esta política.
--
-- Va condicionado porque fuera de Supabase el esquema `storage` no existe y
-- las pruebas corren contra un Postgres pelado.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    drop policy if exists "avatares: lectura pública" on storage.objects;
    create policy "avatares: lectura pública" on storage.objects
      for select to authenticated
      using (bucket_id = 'avatares');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. El cumplimiento por semana se calcula una sola vez, aquí
-- ---------------------------------------------------------------------------

-- Progreso lo calculaba en TypeScript con las mismas reglas que
-- `get_habit_stats` aplica en SQL —los días que tocaban, desde que arrancó el
-- reto, y hoy solo si ya está marcado—, o sea dos copias de una regla sutil
-- destinadas a separarse. Queda esta y la pantalla la lee.
--
-- Sin SECURITY DEFINER: la RLS de habits y habit_logs filtra sola a lo propio,
-- y el `where user_id = auth.uid()` es el segundo cerrojo.
create or replace function public.cumplimiento_semanal(p_today date, p_semanas integer)
returns table (
  semana    integer,
  inicio    date,
  fin       date,
  esperados integer,
  cumplidos integer
)
language sql
stable
set search_path = public
as $$
  with lunes as (
    -- La semana empieza en lunes. dow cuenta desde domingo, de ahí el ajuste.
    select (p_today - ((extract(dow from p_today)::integer + 6) % 7))
           - (greatest(p_semanas, 1) - 1) * 7 as primero
  ),
  semanas as (
    select n as semana,
           (select primero from lunes) + n * 7 as inicio,
           (select primero from lunes) + n * 7 + 6 as fin
    from generate_series(0, greatest(p_semanas, 1) - 1) as n
  ),
  dias as (
    select s.semana, s.inicio, s.fin, h.id as habit_id, d::date as dia
    from semanas s
    join habits h
      on h.user_id = (select auth.uid())
     and h.status = 'active'
    cross join lateral generate_series(
      greatest(s.inicio, h.start_date),
      least(s.fin, p_today),
      interval '1 day'
    ) as d
    where extract(dow from d)::smallint = any (h.active_dows)
      -- Hoy solo cuenta si ya está marcado: el día no ha terminado.
      and (
        d::date <> p_today
        or exists (
          select 1 from habit_logs l
          where l.habit_id = h.id and l.log_date = p_today
        )
      )
  )
  select
    s.semana,
    s.inicio,
    s.fin,
    count(d.dia)::integer as esperados,
    count(d.dia) filter (
      where exists (
        select 1 from habit_logs l
        where l.habit_id = d.habit_id
          and l.log_date = d.dia
          and l.status = 'success'
      )
    )::integer as cumplidos
  from semanas s
  left join dias d on d.semana = s.semana
  group by s.semana, s.inicio, s.fin
  order by s.semana;
$$;

comment on function public.cumplimiento_semanal is
  'Días que tocaban y días marcados por semana, para la gráfica de Progreso.
   Las semanas empiezan en lunes; la última termina en p_today.';
