-- 0014 · El día que quedó sin marcar se cierra como recaída, y se puede anotar.
--
-- Desde 0012 un día que tocaba y quedó sin marcar reinicia el reto. Pero ese
-- día se quedaba gris para siempre: nadie sabe si cayó o si se le olvidó, y no
-- hay dónde anotar qué pasó. Ahora, cuando la persona abre la app, cada día
-- que tocaba y no tiene registro se cierra como recaída, marcado como
-- "asumido". Así el calendario lo enseña
-- en amarillo y la app pregunta una vez qué pasó.
--
-- Nada de esto cambia la cuenta: `get_habit_stats` ya partía la racha en ese
-- día; una recaída la parte igual. Y nada devuelve el reto: un día pasado solo
-- puede quedar como recaída, nunca como limpio.
--
-- Se cierra al abrir la app y no con un cron: sin la persona no hay zona
-- horaria fiable ni "hoy". Por eso la función recibe la fecha, como todas.

-- ---------------------------------------------------------------------------
-- 1. Dos columnas en los registros
-- ---------------------------------------------------------------------------

alter table public.habit_logs
  add column if not exists asumido boolean not null default false,
  add column if not exists revisado_en timestamptz;

comment on column public.habit_logs.asumido is
  'true si el día tocaba, quedó sin marcar, y la app lo cerró como recaída al
   abrir la app. false si lo marcó la persona.';

comment on column public.habit_logs.revisado_en is
  'Solo para los asumidos: cuándo la persona contestó qué pasó (con nota o
   sin ella). Nulo = todavía no se le ha preguntado o no contestó.';

-- ---------------------------------------------------------------------------
-- 2. Cerrar los días que tocaban y quedaron sin marcar
-- ---------------------------------------------------------------------------

-- Para cada hábito activo de quien pregunta, cada día desde el inicio hasta
-- ayer que tocaba y no tiene registro se inserta como recaída asumida (también
-- en lo que se construye: la app guarda el "día saltado" como `relapse`, y
-- así lo cuentan las estadísticas y lo pinta el calendario). Hoy no se toca:
-- hoy todavía no ha terminado. Los de hace más de dos semanas nacen
-- revisados: preguntar "¿qué pasó el 3 de agosto?" en septiembre es ruido.
--
-- Sin `security definer`: la RLS de `habit_logs` deja escribir solo filas
-- propias, y la llave compuesta (habit_id, user_id) garantiza que el hábito
-- sea de quien firma. Devuelve cuántos días cerró.
create or replace function public.cerrar_dias_sin_marcar(p_today date)
returns integer
language sql
volatile
set search_path = public
as $$
  with nuevos as (
    insert into habit_logs (habit_id, user_id, log_date, status, asumido, revisado_en)
    select
      h.id,
      h.user_id,
      d::date,
      'relapse',
      true,
      case when d::date < p_today - 14 then now() else null end
    from habits h
    cross join lateral generate_series(
      h.start_date,
      p_today - 1,
      interval '1 day'
    ) as d
    where h.user_id = (select auth.uid())
      and h.status = 'active'
      and extract(dow from d)::smallint = any (h.active_dows)
      and not exists (
        select 1 from habit_logs l
        where l.habit_id = h.id and l.log_date = d::date
      )
    on conflict (habit_id, log_date) do nothing
    returning 1
  )
  select count(*)::integer from nuevos;
$$;

comment on function public.cerrar_dias_sin_marcar(date) is
  'Cierra como recaída asumida cada día que tocaba y quedó sin marcar, desde
   el inicio del hábito hasta ayer. p_today es el día local de
   la persona. Devuelve cuántos cerró.';
