\set ON_ERROR_STOP on
\pset pager off

-- Rol sin privilegios: el superusuario salta RLS, así que probarla con
-- postgres no probaría nada.
create role app_user nologin;
grant usage on schema public, auth to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant execute on all functions in schema public, auth to app_user;

-- Dos cuentas. El trigger debería crear su perfil solo.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@antidoto.test'),
  ('22222222-2222-2222-2222-222222222222', 'beto@antidoto.test');

\echo '--- 1. perfiles creados por el trigger (esperado: 2) ---'
select count(*) as perfiles from public.profiles;

-- El escenario exacto del mockup: reto de 21 días arrancado el 1 de agosto,
-- hoy es 20. Once días limpios, recaída el 12, siete limpios más, hoy sin marcar.
insert into public.habits (id, user_id, name, target_days, start_date)
values ('33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        'Sin alcohol', 21, date '2026-08-01');

insert into public.habit_logs (habit_id, user_id, log_date, status)
select '33333333-3333-3333-3333-333333333333',
       '11111111-1111-1111-1111-111111111111',
       date '2026-08-01' + (d - 1),
       case when d = 12 then 'relapse' else 'success' end
from generate_series(1, 19) as d;

\echo '--- 2. estadísticas (esperado: 18 limpios, 1 recaída, 95%, racha 7, mejor 11) ---'
select * from public.get_habit_stats(
  '33333333-3333-3333-3333-333333333333', date '2026-08-20');

\echo '--- 3. la racha aguanta que hoy no esté marcado, pero no dos días ---'
select
  (public.get_habit_stats('33333333-3333-3333-3333-333333333333', date '2026-08-20')).current_streak as ayer_marcado_hoy_no,
  (public.get_habit_stats('33333333-3333-3333-3333-333333333333', date '2026-08-22')).current_streak as dos_dias_sin_marcar;

\echo '--- 4. frase del día: una sola, y la misma al repetir la consulta ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as cuantas from public.get_daily_quote(date '2026-08-20');
select (select id from public.get_daily_quote(date '2026-08-20'))
     = (select id from public.get_daily_quote(date '2026-08-20')) as estable_al_recargar,
       (select id from public.get_daily_quote(date '2026-08-20'))
    <> (select id from public.get_daily_quote(date '2026-08-21')) as cambia_al_dia_siguiente;

\echo '--- 5. resumen del día de Ana (esperado: 1 fila, hoy sin marcar) ---'
set role app_user;
select name, today_status, clean_days, current_streak
from public.get_daily_overview(date '2026-08-20');

\echo '--- 6. RLS: Beto no ve nada de Ana (esperado: 0, 0, 0) ---'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select
  (select count(*) from public.habits)          as habitos_ajenos,
  (select count(*) from public.habit_logs)      as registros_ajenos,
  (select count(*) from public.get_daily_overview(date '2026-08-20')) as resumen_ajeno;

\echo '--- 7. RLS de escritura: Beto no puede marcar el hábito de Ana ---'
do $$
begin
  insert into public.habit_logs (habit_id, user_id, log_date, status)
  values ('33333333-3333-3333-3333-333333333333',
          '22222222-2222-2222-2222-222222222222', date '2026-08-20', 'success');
  raise exception 'FALLO: la política dejó escribir sobre un hábito ajeno';
exception
  when insufficient_privilege then raise notice 'OK: RLS bloqueó la escritura ajena';
  when foreign_key_violation then raise notice 'OK: bloqueado por integridad referencial';
end;
$$;

\echo '--- 8. un solo registro por hábito y día ---'
reset role;
do $$
begin
  insert into public.habit_logs (habit_id, user_id, log_date, status)
  values ('33333333-3333-3333-3333-333333333333',
          '11111111-1111-1111-1111-111111111111', date '2026-08-05', 'success');
  raise exception 'FALLO: se pudo duplicar el día';
exception
  when unique_violation then raise notice 'OK: el día duplicado fue rechazado';
end;
$$;
