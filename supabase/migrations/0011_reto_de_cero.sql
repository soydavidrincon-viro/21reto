-- 0011 · El reto vuelve a empezar de cero con cada recaída.
--
-- Se va la pregunta del alta "¿Si tengo una recaída?" con sus dos respuestas.
-- Con "sigo contando" la gente marcaba recaídas y el reto seguía como si nada,
-- y un reto que no se puede perder tampoco se cumple: se arrastra. Antídoto es
-- una app de retos, no de hábitos que se llevan de por vida, así que desde
-- aquí una recaída manda el reto a cero. Siempre.
--
-- Lo que NO cambia: la recaída sigue en amarillo, el calendario conserva cada
-- día, `relapses` los cuenta, y un día sin marcar sigue siendo un hueco que
-- pausa y no rompe (0010). Y "cumplimiento" sigue midiendo sobre todos los
-- días que tocaban desde el inicio, porque eso es lo que cuenta el esfuerzo
-- entero y no solo el último tramo.
--
-- `relapse_policy` se queda en la tabla para no romper nada que la lea, pero
-- ya no manda: las funciones la ignoran, el valor por defecto pasa a 'reset'
-- y las filas viejas se ponen en 'reset' para que la columna diga la verdad.

alter table public.habits alter column relapse_policy set default 'reset';
update public.habits set relapse_policy = 'reset' where relapse_policy <> 'reset';

comment on column public.habits.relapse_policy is
  'Desde 0011 siempre ''reset'': una recaída reinicia el reto. La columna se
   conserva por compatibilidad; ninguna función la consulta.';

-- ---------------------------------------------------------------------------
-- Estadísticas: los días del reto son los del tramo en curso
-- ---------------------------------------------------------------------------

-- Misma firma que en 0010, así `get_daily_overview` la sigue encontrando.
--
-- `clean_days` deja de ser "todos los limpios desde el inicio" y pasa a ser
-- los limpios desde la última recaída: es el número que Hoy enseña como
-- "18 de 21", y es el que tiene que volver a cero. Coincide con
-- `current_streak`, y se devuelven los dos para que nada de lo que los lee
-- cambie. `best_streak` es el mejor tramo, que es lo que alguien tiene
-- derecho a recordar después de caer.
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
  -- Cada registro con cuántas recaídas hubo antes o el mismo día: eso parte
  -- la secuencia en tramos. El día de la recaída abre el tramo nuevo con
  -- cero limpios.
  tramos as (
    select
      l.log_date,
      l.status,
      (select count(*) from logs r
        where r.status = 'relapse' and r.log_date <= l.log_date) as tramo
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
  en_curso as (
    select coalesce(
      (select p.limpios from por_tramo p where p.tramo = (select tramo from ultimo)),
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
    coalesce((select max(p.limpios) from por_tramo p), 0)
  from totales t
  cross join esperados e
  cross join en_curso c;
$$;

comment on function public.get_habit_stats(uuid, date) is
  'Días del reto (desde la última recaída), recaídas, cumplimiento sobre los
   días que tocaban desde el inicio, racha y mejor racha. Una recaída reinicia
   el reto; un día sin marcar lo pausa. p_today es el día local de la persona.';
