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
