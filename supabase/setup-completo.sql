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
-- El compañero que elige cada persona en el onboarding.
--
-- Va en profiles y no en habits: es de la persona, no del hábito. Quien lleva
-- tres retos a la vez no quiere tres mascotas distintas mirándolo.

alter table public.profiles
  add column if not exists companion text not null default 'brote'
    check (companion in ('roco', 'chispa', 'brote', 'nube'));

comment on column public.profiles.companion is
  'Personaje que acompaña en la pantalla Hoy. Brote por defecto: es el que se
   presenta como "para quien va empezando".';
-- Foto de perfil.
--
-- El bucket es público de lectura pero cada quien solo escribe en su propia
-- carpeta: el nombre del archivo empieza por el id del usuario y las políticas
-- lo comprueban. Sin eso, cualquiera con la llave pública podría sobrescribir
-- la foto de otro.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatares',
  'avatares',
  true,
  5242880,                                    -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lectura abierta: la foto se muestra en la app y el bucket es público.
drop policy if exists "avatares: lectura pública" on storage.objects;
create policy "avatares: lectura pública" on storage.objects
  for select using (bucket_id = 'avatares');

-- Escritura solo dentro de la carpeta propia. storage.foldername() devuelve el
-- camino partido; el primer tramo tiene que ser el id de quien sube.
drop policy if exists "avatares: subir la propia" on storage.objects;
create policy "avatares: subir la propia" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatares: reemplazar la propia" on storage.objects;
create policy "avatares: reemplazar la propia" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatares: borrar la propia" on storage.objects;
create policy "avatares: borrar la propia" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
-- Antojos.
--
-- El resto de la app cuenta los días que alguien aguantó. Eso dice cómo va,
-- pero no dice nada de por qué. El dato con información dentro es el otro: el
-- momento en que estuvo a punto y no lo hizo. Ahí hay hora, día de la semana y
-- disparador, y de la suma de varios sale lo único que esta app puede decirle a
-- alguien que no sabía ya — "los viernes entre 8 y 11 son tu hora difícil".
--
-- Aguantar un antojo es más trabajo que marcar un día. La app lo trata así.

create table if not exists public.cravings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Opcional a propósito: hay antojos que no cuelgan de ningún hábito, y
  -- obligar a elegir uno antes de poder registrar convertiría un botón de
  -- emergencia en un formulario.
  habit_id uuid,

  -- Cuándo pasó, en dos formas y por razones distintas.
  --
  -- `logged_at` es la marca absoluta, para ordenar y para auditar. `local_*`
  -- son los que valen para el análisis y los manda el cliente: el servidor no
  -- sabe en qué zona vive quien registra, y preguntarle a Postgres qué hora era
  -- devolvería la hora de un centro de datos en Virginia. La regla de la app —
  -- el día lo decide el usuario — vale igual aquí.
  logged_at timestamptz not null default now(),
  local_date date not null,
  local_hour smallint not null check (local_hour between 0 and 23),
  local_dow smallint not null check (local_dow between 0 and 6),   -- 0 = domingo

  intensity smallint not null check (intensity between 1 and 5),

  -- Lista cerrada: con texto libre cada persona escribe "estres", "estrés" y
  -- "mucho estres" y no se puede agrupar nada, que es justo para lo que existe
  -- esta tabla. El matiz va en `note`.
  trigger_key text check (
    trigger_key in ('estres', 'aburrimiento', 'gente', 'lugar', 'celebracion', 'tristeza', 'otro')
  ),
  note text,

  -- Aguantó o cayó. Por defecto aguantó: quien abre la app en pleno antojo
  -- todavía no ha caído, y ese es el caso normal.
  resisted boolean not null default true,

  created_at timestamptz not null default now(),

  -- La llave va contra (id, user_id) y no solo contra id, igual que en
  -- habit_logs. Con la referencia simple, la política de escritura solo
  -- comprueba que user_id sea el de quien escribe, así que cualquiera podría
  -- colgar un antojo suyo del hábito de otra persona.
  --
  -- Con habit_id nulo la restricción no se evalúa (MATCH SIMPLE), que es
  -- exactamente lo que queremos para el antojo suelto.
  foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete cascade
);

comment on table public.cravings is
  'Cada vez que a alguien le dio el antojo, lo haya aguantado o no. Es la tabla
   que convierte el contador en algo que dice por qué.';

-- El listado del día y el histórico reciente.
create index if not exists cravings_user_fecha_idx
  on public.cravings (user_id, local_date desc);

-- La rejilla de día × hora, que es la consulta cara.
create index if not exists cravings_user_dow_hora_idx
  on public.cravings (user_id, local_dow, local_hour);

alter table public.cravings enable row level security;

drop policy if exists "cravings: leer los propios" on public.cravings;
create policy "cravings: leer los propios" on public.cravings
  for select using ((select auth.uid()) = user_id);

drop policy if exists "cravings: crear los propios" on public.cravings;
create policy "cravings: crear los propios" on public.cravings
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "cravings: editar los propios" on public.cravings;
create policy "cravings: editar los propios" on public.cravings
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "cravings: borrar los propios" on public.cravings;
create policy "cravings: borrar los propios" on public.cravings
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Lo que la app lee
-- ---------------------------------------------------------------------------

-- La rejilla de día de la semana × bloque de cuatro horas.
--
-- Bloques y no horas sueltas: con 168 casillas y treinta antojos, la rejilla
-- por hora sale casi vacía y cualquier casilla con dos registros parece un
-- patrón. Seis bloques por día es lo más fino que aguanta el volumen que tiene
-- una persona de verdad.
--
-- Sin `security definer`: así la RLS de arriba filtra sola y la función no
-- puede devolver los antojos de nadie más ni por descuido.
create or replace function public.get_craving_grid(p_since date)
returns table (
  dow smallint,
  block smallint,          -- 0 = 00-04, 1 = 04-08, … 5 = 20-24
  total bigint,
  resisted bigint
)
language sql
stable
set search_path = public
as $$
  select
    local_dow                       as dow,
    (local_hour / 4)::smallint      as block,
    count(*)                        as total,
    count(*) filter (where c.resisted) as resisted
  from public.cravings c
  where local_date >= p_since
  group by 1, 2
$$;

-- El resumen en una fila. Lo que la app convierte en una frase.
--
-- `min_para_hablar` no es decoración: con cuatro antojos cualquier patrón es
-- ruido, y afirmar "tu hora difícil son los martes" con esa muestra sería
-- inventar. La app enseña el número que falta hasta llegar ahí.
create or replace function public.get_craving_summary(p_since date)
returns table (
  total bigint,
  resisted bigint,
  caved bigint,
  top_trigger text,
  top_trigger_total bigint,
  top_dow smallint,
  top_block smallint,
  top_block_total bigint
)
language sql
stable
set search_path = public
as $$
  with propios as (
    select * from public.cravings where local_date >= p_since
  ),
  totales as (
    select
      count(*)                              as total,
      count(*) filter (where resisted)      as resisted,
      count(*) filter (where not resisted)  as caved
    from propios
  ),
  disparador as (
    select trigger_key, count(*) as n
    from propios
    where trigger_key is not null
    group by 1
    order by n desc, trigger_key
    limit 1
  ),
  momento as (
    select local_dow as dow, (local_hour / 4)::smallint as block, count(*) as n
    from propios
    group by 1, 2
    order by n desc, dow, block
    limit 1
  )
  select
    totales.total,
    totales.resisted,
    totales.caved,
    disparador.trigger_key,
    disparador.n,
    momento.dow,
    momento.block,
    momento.n
  from totales
  left join disparador on true
  left join momento on true
$$;
-- En qué días de la semana toca el hábito.
--
-- Hasta aquí, la app daba por hecho que todo se hace todos los días. Para lo
-- que se deja es verdad —no beber es de lunes a domingo— pero para lo que se
-- construye casi nunca lo es: quien se pone "Ejercicio" va martes, jueves y
-- sábado, y la app le rompía la racha cada miércoles por no haber ido al
-- gimnasio un día que nunca pensó ir. Eso no es un contador estricto, es un
-- contador equivocado.
--
-- La consecuencia es que la racha ya no se puede contar sobre días de
-- calendario seguidos. Hay que contarla sobre los días en que tocaba, y de eso
-- va casi todo lo que sigue.

-- Los videos de hábito de la migración anterior no llegaron a usarse: fueron un
-- malentendido mío al leer la petición, que era esto. Si alguien alcanzó a
-- aplicar aquella migración, esto se lleva la tabla; si no, no hace nada.
drop table if exists public.habit_videos;

alter table public.habits
  add column if not exists active_dows smallint[] not null default '{0,1,2,3,4,5,6}';

-- 0 = domingo, como en `extract(dow)` de Postgres y en `getDay()` del
-- navegador. Coincidir con los dos evita la conversión que siempre se olvida en
-- algún sitio.
--
-- El array no puede quedar vacío: un hábito que no toca ningún día no es un
-- hábito, es una fila que nunca se puede marcar y que dejaría la racha muerta
-- para siempre sin forma de revivirla.
alter table public.habits
  drop constraint if exists habits_active_dows_check;
alter table public.habits
  add constraint habits_active_dows_check check (
    cardinality(active_dows) between 1 and 7
    and active_dows <@ array[0,1,2,3,4,5,6]::smallint[]
  );

comment on column public.habits.active_dows is
  'Días de la semana en que toca este hábito (0 = domingo). Por defecto todos,
   que es como se comportaba antes de existir esta columna.';

-- ---------------------------------------------------------------------------
-- Contar días en los que tocaba
-- ---------------------------------------------------------------------------

-- Cuántos días de los que tocan han pasado desde siempre hasta `p_date`.
--
-- Es el truco que hace que todo lo demás sea el código de antes. Si a cada
-- fecha le pones el número de orden que ocupa entre los días en que sí tocaba,
-- dos días consecutivos "de los que tocan" quedan en números consecutivos —
-- aunque entre ellos hayan pasado cuatro días de calendario. A partir de ahí, la
-- racha se calcula igual que siempre: buscando números seguidos.
--
-- Sin bucle ni generate_series, que aquí se llama una vez por registro. El
-- epoch es un domingo (1970-01-04), así que `(p_date - epoch) % 7` es
-- directamente el día de la semana y no hace falta convertir nada.
create or replace function public.dias_que_tocan_hasta(
  p_dows smallint[],
  p_date date
)
returns integer
language sql
immutable
parallel safe
as $$
  select
    ((p_date - date '1970-01-04') / 7) * cardinality(p_dows)
    + (
      select count(*)::integer
      from unnest(p_dows) as d
      where d <= (p_date - date '1970-01-04') % 7
    )
$$;

comment on function public.dias_que_tocan_hasta is
  'Número de orden de una fecha entre los días en que toca el hábito. Dos días
   consecutivos de los que tocan se diferencian en 1.';

-- ---------------------------------------------------------------------------
-- Las estadísticas, ahora contando sobre los días en que tocaba
-- ---------------------------------------------------------------------------

-- Con `active_dows` en todos los días, `dias_que_tocan_hasta` devuelve
-- exactamente los días transcurridos, así que esta función se comporta igual
-- que la de antes para todo hábito que ya existía. Nadie pierde una racha por
-- esta migración.
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
    select active_dows from habits where id = p_habit_id
  ),
  logs as (
    select log_date, status
    from habit_logs
    where habit_id = p_habit_id
  ),
  clean as (
    select
      log_date,
      public.dias_que_tocan_hasta((select active_dows from h), log_date)
        - (row_number() over (order by log_date))::integer as island
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
    -- La racha sigue viva mientras no se haya saltado ningún día de los que
    -- tocaban. Antes esto era "el último día limpio fue hoy o ayer"; ahora es
    -- lo mismo pero contando en días que tocan, así que un martes sin marcar
    -- no rompe nada si el hábito es de lunes, miércoles y viernes.
    coalesce(
      (
        select r.length
        from runs r
        where public.dias_que_tocan_hasta((select active_dows from h), r.ends_on)
              >= public.dias_que_tocan_hasta((select active_dows from h), p_today) - 1
        order by r.ends_on desc
        limit 1
      ),
      0
    ),
    coalesce((select max(r.length) from runs r), 0)
  from totals t;
$$;

-- ---------------------------------------------------------------------------
-- Lo que lee la pantalla de Hoy
-- ---------------------------------------------------------------------------

-- `create or replace` no vale aquí: Postgres no deja cambiarle el tipo de
-- retorno a una función que ya existe, y esta gana dos columnas. Hay que
-- tirarla y volver a crearla. Va dentro de la misma migración, así que corre en
-- una sola transacción y no hay un instante en que la app se quede sin ella.
drop function if exists public.get_daily_overview(date);

-- Se le añaden dos columnas: en qué días toca, y si hoy es uno de ellos. La
-- segunda se calcula aquí y no en el cliente porque el día ya viene resuelto en
-- la zona horaria de quien mira —es el parámetro p_date— y volver a deducirlo
-- del reloj del navegador sería la forma más fácil de romper la regla de la app.
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
    h.active_dows,
    extract(dow from p_date)::smallint = any (h.active_dows),
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
-- Dos cuentas que estaban mal.
--
-- 1) La política de recaída no hacía nada. Se pregunta al crear el hábito, se
--    guarda, se lee — y el cálculo de la racha nunca la miraba. "Sigo contando"
--    y "Vuelvo a empezar de cero" se comportaban idéntico: la recaída rompía la
--    racha siempre. Quien eligió no castigarse se castigaba igual.
--
-- 2) El cumplimiento se calculaba sobre los días registrados, no sobre los que
--    tocaban. Un día que no marcaste no contaba ni a favor ni en contra, así
--    que abandonar la app durante un mes dejaba el porcentaje intacto. Si no lo
--    marcaste, es un día fallado.

-- ---------------------------------------------------------------------------
-- Cuántas recaídas lleva un hábito hasta una fecha
-- ---------------------------------------------------------------------------

-- Hace falta para "sigo contando": si una recaída no rompe la racha, entonces
-- ese día no ocupa sitio en la cuenta, y los días de antes y de después quedan
-- pegados. Restar las recaídas acumuladas es exactamente eso.
create or replace function public.recaidas_hasta(p_habit_id uuid, p_date date)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::integer
  from habit_logs
  where habit_id = p_habit_id
    and status = 'relapse'
    and log_date <= p_date
$$;

-- ---------------------------------------------------------------------------
-- Las estadísticas
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
  with h as (
    select active_dows, relapse_policy, start_date
    from habits where id = p_habit_id
  ),
  logs as (
    select log_date, status
    from habit_logs
    where habit_id = p_habit_id
  ),
  /*
   * A cada día registrado se le pone el número de orden que ocupa en la
   * secuencia de días que cuentan para la racha.
   *
   * Base: cuántos días de los que tocan han pasado (eso ya salta los martes de
   * quien va lunes, miércoles y viernes).
   *
   * Y con la política "sigo contando" se le restan las recaídas acumuladas, con
   * lo que los días a cada lado de una recaída quedan en números consecutivos —
   * que es literalmente lo que promete esa opción. Con "vuelvo a empezar" no se
   * resta nada y la recaída parte la racha, como antes.
   */
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
  /*
   * Cuántos días tocaba haber marcado a estas alturas.
   *
   * Desde el arranque del reto hasta hoy, contando solo los días en que tocaba.
   * Hoy se descuenta si todavía no se ha marcado: el día no ha terminado y
   * suspender a alguien a las ocho de la mañana no es medir, es apurar.
   */
  -- `from h` y no subconsultas sueltas: dentro de `any(...)`, un
  -- `(select ...)` se interpreta como subconsulta y no como el array que es,
  -- y Postgres corta con "operator does not exist: smallint = smallint[]".
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
    -- Sobre los días que tocaban, no sobre los que se registraron. Se topa en
    -- 100 porque marcar un día libre suma limpios sin sumar esperados.
    case
      when e.total = 0 then 0
      else least(100, round(t.clean_days::numeric * 100 / e.total))::integer
    end,
    -- La racha sigue viva mientras no se haya perdido ningún día de los que
    -- contaban. Con "sigo contando", una recaída no cuenta como perdido.
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

comment on function public.get_habit_stats is
  'Racha, mejor racha y cumplimiento de un hábito. Respeta relapse_policy y
   cuenta el cumplimiento sobre los días en que tocaba, no sobre los
   registrados: un día sin marcar es un día fallado.';
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
