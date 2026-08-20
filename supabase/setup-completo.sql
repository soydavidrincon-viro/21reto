-- Antídoto — instalación completa en un solo archivo.
-- Pégalo entero en el SQL Editor de Supabase y dale Run.
-- Equivale a correr, en orden: migrations/0001, migrations/0002 y seed.sql.
-- Generado desde esos archivos; si cambias el esquema, regenera este con
-- el script de abajo en vez de editarlo a mano.
--
--   cat supabase/migrations/*.sql supabase/seed.sql > supabase/setup-completo.sql

----------------------------------------------------------------------------
-- 1. Esquema, políticas RLS y funciones
----------------------------------------------------------------------------

-- Antídoto — esquema inicial
--
-- Regla que atraviesa todo el archivo: la fecha del día NUNCA se calcula con
-- now() ni current_date del servidor. El cliente resuelve qué día es en la zona
-- horaria del perfil y la manda como parámetro. Si el servidor decidiera, quien
-- marca a las 11 de la noche en México vería su check caer en el día siguiente
-- y perdería la racha.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  avatar_url    text,
  timezone      text        not null default 'UTC',
  theme         text        not null default 'system'
                check (theme in ('system', 'light', 'dark')),
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------

create table public.habits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null check (length(trim(name)) between 1 and 80),
  description     text check (length(description) <= 500),
  kind            text not null default 'quit'
                  check (kind in ('quit', 'build')),
  icon            text not null default '🎯',
  color           text not null default 'blue'
                  check (color in ('blue', 'orange', 'green', 'yellow', 'purple', 'pink')),
  target_days     integer not null default 21 check (target_days between 1 and 365),
  start_date      date not null,
  status          text not null default 'active'
                  check (status in ('active', 'completed', 'archived')),
  -- Qué pasa con la racha cuando hay una recaída. 'continue' deja el reto vivo
  -- y solo registra el día; 'reset' vuelve el contador a cero.
  relapse_policy  text not null default 'continue'
                  check (relapse_policy in ('reset', 'continue')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Redundante frente a la clave primaria, pero es el anclaje de la llave
  -- foránea compuesta de habit_logs. Ver la nota allá abajo.
  unique (id, user_id)
);

create index habits_user_status_idx on public.habits (user_id, status);

-- ---------------------------------------------------------------------------
-- habit_logs — un registro por hábito por día
-- ---------------------------------------------------------------------------

create table public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  log_date    date not null,
  status      text not null check (status in ('success', 'relapse', 'skipped')),
  note        text check (length(note) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (habit_id, log_date),

  -- La llave va contra (id, user_id) y no solo contra id. Con la referencia
  -- simple, la política RLS de escritura solo comprueba que user_id sea el de
  -- quien escribe, así que cualquiera podía insertar un registro suyo colgando
  -- del hábito de otra persona. Con la compuesta, la fila no existe si el
  -- hábito no es de quien lo firma: lo garantiza el esquema, no la política.
  foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete cascade
);

create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date desc);

-- ---------------------------------------------------------------------------
-- journal_entries — una entrada por usuario por día
-- ---------------------------------------------------------------------------

create table public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  entry_date  date not null,
  mood        text not null,
  intensity   smallint not null default 3 check (intensity between 1 and 5),
  note        text check (length(note) <= 4000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index journal_entries_user_date_idx on public.journal_entries (user_id, entry_date desc);

-- ---------------------------------------------------------------------------
-- quotes — catálogo público, sin dueño
-- ---------------------------------------------------------------------------

create table public.quotes (
  id      uuid primary key default gen_random_uuid(),
  text    text not null,
  author  text,
  tag     text,
  active  boolean not null default true
);

create index quotes_active_idx on public.quotes (active) where active;

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch        before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger habits_touch          before update on public.habits
  for each row execute function public.touch_updated_at();
create trigger habit_logs_touch      before update on public.habit_logs
  for each row execute function public.touch_updated_at();
create trigger journal_entries_touch before update on public.journal_entries
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Perfil automático al registrarse
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, 'amigo@antidoto'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.habits          enable row level security;
alter table public.habit_logs      enable row level security;
alter table public.journal_entries enable row level security;
alter table public.quotes          enable row level security;

create policy "perfil propio: leer"     on public.profiles
  for select using ((select auth.uid()) = id);
create policy "perfil propio: crear"    on public.profiles
  for insert with check ((select auth.uid()) = id);
create policy "perfil propio: editar"   on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "hábitos propios: leer"   on public.habits
  for select using ((select auth.uid()) = user_id);
create policy "hábitos propios: crear"  on public.habits
  for insert with check ((select auth.uid()) = user_id);
create policy "hábitos propios: editar" on public.habits
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "hábitos propios: borrar" on public.habits
  for delete using ((select auth.uid()) = user_id);

create policy "registros propios: leer"   on public.habit_logs
  for select using ((select auth.uid()) = user_id);
create policy "registros propios: crear"  on public.habit_logs
  for insert with check ((select auth.uid()) = user_id);
create policy "registros propios: editar" on public.habit_logs
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "registros propios: borrar" on public.habit_logs
  for delete using ((select auth.uid()) = user_id);

create policy "bitácora propia: leer"   on public.journal_entries
  for select using ((select auth.uid()) = user_id);
create policy "bitácora propia: crear"  on public.journal_entries
  for insert with check ((select auth.uid()) = user_id);
create policy "bitácora propia: editar" on public.journal_entries
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bitácora propia: borrar" on public.journal_entries
  for delete using ((select auth.uid()) = user_id);

-- Las frases son catálogo: cualquiera las lee, nadie las escribe desde el cliente.
create policy "frases: lectura pública" on public.quotes
  for select using (active);

-- ---------------------------------------------------------------------------
-- Estadísticas de un hábito
--
-- Islas y huecos: a cada día limpio se le resta su número de fila, así los días
-- consecutivos comparten el mismo valor y cada valor distinto es una racha.
-- ---------------------------------------------------------------------------

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
  with logs as (
    select log_date, status
    from habit_logs
    where habit_id = p_habit_id
  ),
  clean as (
    select
      log_date,
      log_date - (row_number() over (order by log_date))::integer as island
    from logs
    where status = 'success'
  ),
  runs as (
    select island, count(*)::integer as length, max(log_date) as ends_on
    from clean
    group by island
  ),
  totals as (
    select
      count(*) filter (where status = 'success')::integer as clean_days,
      count(*) filter (where status = 'relapse')::integer as relapses
    from logs
  )
  select
    t.clean_days,
    t.relapses,
    case
      when t.clean_days + t.relapses = 0 then 0
      else round(t.clean_days::numeric * 100 / (t.clean_days + t.relapses))::integer
    end,
    -- La racha sigue viva si el último día limpio fue hoy o ayer: no marcar
    -- todavía el día en curso no cuenta como romperla.
    coalesce(
      (select r.length from runs r where r.ends_on >= p_today - 1 order by r.ends_on desc limit 1),
      0
    ),
    coalesce((select max(r.length) from runs r), 0)
  from totals t;
$$;

-- ---------------------------------------------------------------------------
-- Resumen del día: una sola consulta para la pantalla Hoy.
-- Recibe la fecha local del usuario; nunca la deduce.
-- ---------------------------------------------------------------------------

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
  today_status   text,
  today_note     text,
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
    l.status,
    l.note,
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
-- Frase del día: determinista por usuario y fecha, para que no cambie al
-- recargar y no le toque la misma a todo el mundo.
-- ---------------------------------------------------------------------------

create or replace function public.get_daily_quote(p_date date)
returns table (id uuid, text text, author text)
language sql
stable
set search_path = public
as $$
  with pool as (
    select q.id, q.text, q.author, row_number() over (order by q.id) - 1 as n
    from quotes q
    where q.active
  ),
  pick as (
    -- bit(32)::bigint sale con signo, así que el abs() no es decorativo:
    -- sin él la mitad de los hashes daría índice negativo y ninguna frase.
    select
      (
        abs(('x' || substr(md5(coalesce((select auth.uid())::text, 'anon') || p_date::text), 1, 8))::bit(32)::bigint)
        % greatest((select count(*) from pool), 1)
      ) as n
  )
  select p.id, p.text, p.author
  from pool p, pick
  where p.n = pick.n;
$$;

----------------------------------------------------------------------------
-- 2. Borrado de la propia cuenta
----------------------------------------------------------------------------

-- Borrar la propia cuenta sin pasar por la service_role key.
--
-- Eliminar de auth.users pide privilegios que el cliente no tiene, y la
-- alternativa habitual —mandar la service_role key a algún backend— pone en
-- circulación una llave que se salta todas las políticas. Con SECURITY DEFINER
-- la función corre con los permisos de su dueño pero solo puede borrar la fila
-- de quien la invoca: el id no es un parámetro, sale de auth.uid().
--
-- El resto de las tablas cuelgan de auth.users con ON DELETE CASCADE, así que
-- perfil, hábitos, registros y bitácora se van con la cuenta.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  quien uuid := (select auth.uid());
begin
  if quien is null then
    raise exception 'No hay sesión activa.' using errcode = '28000';
  end if;

  delete from auth.users where id = quien;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

----------------------------------------------------------------------------
-- 3. Frases del día
----------------------------------------------------------------------------

-- Frases del día. Tono deliberado: acompañan, no arengan. Nada de "tú puedes
-- con todo" ni promesas de que será fácil — quien está dejando algo ya escuchó
-- eso mil veces y no le sirvió.

insert into public.quotes (text, author, tag) values
  ('No tienes que ganarle a la vida entera hoy. Solo a este día.', null, 'hoy'),
  ('Las ganas se van solas si les das veinte minutos.', null, 'craving'),
  ('Nadie deja nada de un solo golpe. Se deja un día a la vez, muchas veces.', null, 'proceso'),
  ('El impulso es una ola: sube, revienta y baja. No tienes que nadar, solo esperar.', null, 'craving'),
  ('Hoy no es para siempre. Hoy es hoy.', null, 'hoy'),
  ('La incomodidad de resistir dura menos que el arrepentimiento de ceder.', null, 'craving'),
  ('Estás cambiando algo que llevaba años en automático. Claro que cuesta.', null, 'proceso'),
  ('Contar los días también es una forma de cuidarte.', null, 'racha'),
  ('Que hoy sea difícil no significa que estés fallando.', null, 'dificil'),
  ('Un día limpio no se borra. Ya es tuyo.', null, 'racha'),
  ('El cuerpo tarda en creerte. Dale tiempo.', null, 'proceso'),
  ('Lo que hoy te pide el impulso, mañana no lo va a recordar.', null, 'craving'),
  ('No estás renunciando a algo. Estás recuperando algo.', null, 'sentido'),
  ('La constancia no es no fallar nunca. Es volver siempre.', null, 'recaida'),
  ('Si hoy solo pudiste aguantar, hoy hiciste suficiente.', null, 'dificil'),
  ('Cada vez que no cedes, la próxima vez pesa un poco menos.', null, 'craving'),
  ('Tu yo de mañana está esperando a ver qué haces hoy.', null, 'hoy'),
  ('Empezar de nuevo no borra lo que ya aprendiste.', null, 'recaida'),
  ('El aburrimiento también pasa. No hace falta llenarlo con eso.', null, 'craving'),
  ('Aguantar hoy no te hace especial. Te hace consistente.', null, 'racha'),
  ('Lo difícil no es decidirlo. Es sostenerlo un martes cualquiera.', null, 'proceso'),
  ('Nadie está mirando. Por eso cuenta más.', null, 'sentido'),
  ('El día que no tienes ganas es el día que más suma.', null, 'dificil'),
  ('Una recaída es un dato, no un veredicto.', null, 'recaida'),
  ('No te prometas nunca más. Prométete hoy no.', null, 'hoy'),
  ('La ansiedad de las primeras semanas no es señal de que va mal.', null, 'proceso'),
  ('Cambiar de hábito es cambiar de identidad, y eso incomoda.', null, 'sentido'),
  ('Hoy elegiste distinto. Eso ya cambia algo.', null, 'racha'),
  ('Si te caíste, lo urgente no es explicarlo. Es el día siguiente.', null, 'recaida'),
  ('Los primeros días son los más ruidosos. Después baja el volumen.', null, 'proceso'),
  ('No necesitas motivación. Necesitas que hoy termine.', null, 'dificil'),
  ('La parte de ti que quiere dejarlo también eres tú.', null, 'sentido'),
  ('Sumar un día no se siente a nada. Sumar treinta sí.', null, 'racha'),
  ('Descansa, come, duerme. Buena parte del impulso es cansancio disfrazado.', null, 'craving'),
  ('Contarle a alguien lo hace más difícil de esconder. Por eso funciona.', null, 'apoyo'),
  ('El deseo no es una orden.', null, 'craving'),
  ('Hoy vale por sí mismo, aunque mañana falles.', null, 'hoy'),
  ('Lo que estás haciendo no se ve por fuera todavía. Se está viendo por dentro.', null, 'proceso'),
  ('No busques sentirte bien. Busca terminar el día.', null, 'dificil'),
  ('Volver al día uno duele, pero el día uno ya lo sabes hacer.', null, 'recaida'),
  ('Una racha larga empieza igual que una corta.', null, 'racha'),
  ('El alivio que promete dura menos que lo que cobra.', null, 'craving'),
  ('Escribe qué sentiste hoy. Mañana te va a servir.', null, 'bitacora'),
  ('No te midas contra quien empezó hace un año.', null, 'sentido'),
  ('Estar incómodo y no ceder es exactamente el ejercicio.', null, 'craving'),
  ('Hay días que solo hay que atravesar. Hoy puede ser uno.', null, 'dificil'),
  ('Lo que repites te construye, aunque no lo notes.', null, 'proceso'),
  ('Perdiste un día, no el progreso.', null, 'recaida'),
  ('Marcar el día es un acto pequeño. Repetirlo no.', null, 'racha'),
  ('El impulso miente sobre cuánto va a durar.', null, 'craving'),
  ('No tienes que sentirte fuerte para actuar como si lo fueras.', null, 'dificil'),
  ('Lo dejaste hoy. Eso ya es un hecho, no una intención.', null, 'hoy'),
  ('Si el día se te complicó, cambia el plan, no la meta.', null, 'proceso'),
  ('Pedir ayuda no es recaer. Muchas veces es lo contrario.', null, 'apoyo'),
  ('La vergüenza empuja a repetir. La honestidad, no.', null, 'recaida'),
  ('Vas a querer dejarlo justo cuando empiece a funcionar.', null, 'proceso'),
  ('No hace falta que sea para siempre. Solo que sea hoy.', null, 'hoy'),
  ('Tu racha no te define. Lo que haces cuando se rompe, un poco más.', null, 'recaida'),
  ('Estás aprendiendo a estar contigo sin eso. Toma tiempo.', null, 'sentido'),
  ('Hoy también cuenta, aunque nadie te aplauda.', null, 'racha');
