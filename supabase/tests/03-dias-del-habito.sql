\set ON_ERROR_STOP on
\pset pager off

-- Pruebas de los días en que toca un hábito.
--
-- Lo que se está comprobando es una sola cosa, y es la que hacía falta arreglar:
-- que a alguien que va al gimnasio lunes, miércoles y viernes no se le rompa la
-- racha el martes.
--
-- Usuarios propios: 01 y 02 terminan probando cascadas de borrado, así que sus
-- usuarios ya no existen cuando llega este fichero. Aquí son Eva y Fran.

insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'eva@antidoto.test'),
  ('99999999-9999-9999-9999-999999999999', 'fran@antidoto.test');

-- Agosto de 2026: el día 3 es lunes, el 5 miércoles, el 7 viernes.
-- Eva va al gimnasio lunes, miércoles y viernes. Fran lee todos los días.
insert into public.habits (id, user_id, name, kind, target_days, start_date, active_dows)
values
  ('a8888888-8888-8888-8888-888888888888',
   '88888888-8888-8888-8888-888888888888',
   'Ejercicio', 'build', 21, date '2026-08-03', '{1,3,5}'),
  ('b9999999-9999-9999-9999-999999999999',
   '99999999-9999-9999-9999-999999999999',
   'Leer', 'build', 21, date '2026-08-03', '{0,1,2,3,4,5,6}');

\echo '--- 1. el número de orden salta de uno en uno entre días que tocan ---'
\echo '    (lun 3, mié 5 y vie 7 deben salir consecutivos; el mar 4 repite el del lun)'
select
  d::date                                                as fecha,
  to_char(d, 'Dy')                                       as dia,
  public.dias_que_tocan_hasta('{1,3,5}'::smallint[], d::date)
    - public.dias_que_tocan_hasta('{1,3,5}'::smallint[], date '2026-08-02') as orden
from generate_series(date '2026-08-03', date '2026-08-07', interval '1 day') d;

\echo '--- 2. con los siete días, el orden es el día de calendario (esperado: 0,1,2,3,4) ---'
select
  public.dias_que_tocan_hasta('{0,1,2,3,4,5,6}'::smallint[], d::date)
    - public.dias_que_tocan_hasta('{0,1,2,3,4,5,6}'::smallint[], date '2026-08-02') as orden
from generate_series(date '2026-08-03', date '2026-08-07', interval '1 day') d;

-- Eva marca sus tres días: lunes 3, miércoles 5, viernes 7. No marca el martes
-- ni el jueves porque no le tocaba.
insert into public.habit_logs (habit_id, user_id, log_date, status) values
  ('a8888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888', '2026-08-03', 'success'),
  ('a8888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888', '2026-08-05', 'success'),
  ('a8888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888', '2026-08-07', 'success');

\echo '--- 3. EL CASO: racha de 3 el viernes, sin haber marcado martes ni jueves ---'
do $$
declare r integer;
begin
  select current_streak into r
  from public.get_habit_stats('a8888888-8888-8888-8888-888888888888', date '2026-08-07');
  if r <> 3 then
    raise exception 'FALLO: la racha de lun/mié/vie salió %, se esperaba 3', r;
  end if;
  raise notice 'OK: racha = 3 con los días intermedios sin marcar';
end $$;

\echo '--- 4. el sábado (no toca) la racha sigue viva, no se cae por no marcar ---'
do $$
declare r integer;
begin
  select current_streak into r
  from public.get_habit_stats('a8888888-8888-8888-8888-888888888888', date '2026-08-08');
  if r <> 3 then
    raise exception 'FALLO: el sábado la racha salió %, se esperaba 3', r;
  end if;
  raise notice 'OK: un día que no toca no rompe la racha';
end $$;

\echo '--- 5. saltarse un día que SÍ tocaba sí rompe la racha ---'
\echo '    (el miércoles 12 sin haber marcado el lunes 10: esperado 0)'
do $$
declare r integer;
begin
  select current_streak into r
  from public.get_habit_stats('a8888888-8888-8888-8888-888888888888', date '2026-08-12');
  if r <> 0 then
    raise exception 'FALLO: saltarse el lunes dejó la racha en %, se esperaba 0', r;
  end if;
  raise notice 'OK: faltar un día de los que tocan sí la rompe';
end $$;

\echo '--- 6. la mejor racha también cuenta sobre días que tocan (esperado: 3) ---'
select best_streak
from public.get_habit_stats('a8888888-8888-8888-8888-888888888888', date '2026-08-12');

-- Fran lee lunes, martes y miércoles seguidos, y se salta el jueves.
insert into public.habit_logs (habit_id, user_id, log_date, status) values
  ('b9999999-9999-9999-9999-999999999999', '99999999-9999-9999-9999-999999999999', '2026-08-03', 'success'),
  ('b9999999-9999-9999-9999-999999999999', '99999999-9999-9999-9999-999999999999', '2026-08-04', 'success'),
  ('b9999999-9999-9999-9999-999999999999', '99999999-9999-9999-9999-999999999999', '2026-08-05', 'success');

\echo '--- 7. un hábito de todos los días se comporta igual que antes de la migración ---'
do $$
declare viva integer; rota integer;
begin
  select current_streak into viva
  from public.get_habit_stats('b9999999-9999-9999-9999-999999999999', date '2026-08-06');
  select current_streak into rota
  from public.get_habit_stats('b9999999-9999-9999-9999-999999999999', date '2026-08-07');
  if viva <> 3 then
    raise exception 'FALLO: el jueves sin marcar la racha salió %, se esperaba 3', viva;
  end if;
  if rota <> 0 then
    raise exception 'FALLO: tras saltarse el jueves salió %, se esperaba 0', rota;
  end if;
  raise notice 'OK: 3 el jueves (aún sin marcar) y 0 el viernes (ya saltado)';
end $$;

\echo '--- 8. get_daily_overview dice si hoy toca (mié: Eva sí, vie: Eva sí, mar: Eva no) ---'
grant select on public.habits to app_user;
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
set role app_user;
select
  (select toca_hoy from public.get_daily_overview(date '2026-08-05')) as miercoles,
  (select toca_hoy from public.get_daily_overview(date '2026-08-04')) as martes,
  (select active_dows from public.get_daily_overview(date '2026-08-04')) as dias;

\echo '--- 9. RLS: Fran no ve el hábito de Eva en su resumen (esperado: solo Leer) ---'
set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
select name from public.get_daily_overview(date '2026-08-05');

\echo '--- 10. el esquema no deja un hábito sin ningún día ---'
reset role;
do $$
begin
  begin
    update public.habits set active_dows = '{}'
    where id = 'a8888888-8888-8888-8888-888888888888';
    raise exception 'FALLO: se guardó un hábito sin ningún día';
  exception
    when check_violation then
      raise notice 'OK: un hábito sin días queda rechazado';
  end;

  begin
    update public.habits set active_dows = '{1,7}'
    where id = 'a8888888-8888-8888-8888-888888888888';
    raise exception 'FALLO: se guardó un día de la semana inventado (7)';
  exception
    when check_violation then
      raise notice 'OK: los días fuera de 0..6 quedan rechazados';
  end;
end $$;
