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
