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
