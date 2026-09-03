-- Videos de un hábito.
--
-- Para lo que se deja, el trabajo es no hacerlo. Para lo que se empieza, el
-- trabajo es saber qué hacer, y ahí el contador no ayuda: alguien que se puso
-- "Ejercicio" abre la app, ve que lleva nueve días y sigue sin saber qué rutina
-- le toca hoy. Esta tabla guarda los videos que esa persona ya eligió aplicar,
-- para que la app tenga algo que ofrecer y no solo algo que contar.
--
-- La UI solo los muestra en los hábitos de tipo 'build'. Eso no se ata aquí a
-- propósito: el esquema no sabe de pantallas, y colgarle un disparador que
-- consulte `habits.kind` en cada inserción costaría una lectura extra para
-- imponer una decisión de producto que puede cambiar mañana.

create table if not exists public.habit_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Obligatorio, al revés que en `cravings`: un antojo suelto existe —te dio y
  -- ya— pero un video sin hábito no es nada, es un enlace sin sitio donde
  -- aparecer.
  habit_id uuid not null,

  -- El esquema es el último sitio donde se puede impedir un `javascript:` en un
  -- campo que la app pinta como enlace. La acción de servidor valida lo mismo
  -- antes de escribir; esto es el cerrojo que no depende de que nadie se
  -- acuerde.
  url text not null check (
    url ~* '^https?://' and length(url) between 8 and 2000
  ),

  -- Opcional: quien pega un enlace a las siete de la mañana no le pone título.
  -- Cuando falta, la app enseña de dónde sale el video.
  title text check (length(title) <= 120),

  created_at timestamptz not null default now(),

  -- Llave compuesta, igual que en `habit_logs` y `cravings`. Con la referencia
  -- simple sobre `habit_id`, la política de escritura solo comprobaría que
  -- `user_id` es el de quien escribe, así que cualquiera podría colgar un video
  -- del hábito de otra persona.
  foreign key (habit_id, user_id)
    references public.habits (id, user_id) on delete cascade
);

comment on table public.habit_videos is
  'Los videos que alguien eligió aplicar a un hábito que está construyendo.';

create index if not exists habit_videos_habit_idx
  on public.habit_videos (habit_id, created_at);

alter table public.habit_videos enable row level security;

drop policy if exists "habit_videos: leer los propios" on public.habit_videos;
create policy "habit_videos: leer los propios" on public.habit_videos
  for select using ((select auth.uid()) = user_id);

drop policy if exists "habit_videos: crear los propios" on public.habit_videos;
create policy "habit_videos: crear los propios" on public.habit_videos
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "habit_videos: editar los propios" on public.habit_videos;
create policy "habit_videos: editar los propios" on public.habit_videos
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "habit_videos: borrar los propios" on public.habit_videos;
create policy "habit_videos: borrar los propios" on public.habit_videos
  for delete using ((select auth.uid()) = user_id);
