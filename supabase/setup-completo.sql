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
