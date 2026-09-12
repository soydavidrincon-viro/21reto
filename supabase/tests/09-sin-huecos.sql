\set ON_ERROR_STOP on
\pset pager off

-- Pruebas del reto sin huecos (migración 0012).
--
-- Lo que se comprueba: hoy sin marcar no cuenta todavía; un día pasado que
-- tocaba y quedó sin marcar reinicia el reto; los días que no tocan no
-- cuentan; la mejor racha recuerda la tira anterior; `huecos_pendientes` ya
-- no existe; `get_daily_overview` ya no trae `pendientes`; y el aviso de la
-- noche cuenta los hábitos sin marcar hoy.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email) values
  ('a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9', 'lola@antidoto.test');

-- Agosto de 2026: el 3 es lunes. Todos los días.
insert into public.habits
  (id, user_id, name, kind, target_days, start_date, active_dows)
values ('c9c9c9c9-c9c9-c9c9-c9c9-c9c9c9c9c9c9',
        'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9',
        'Sin azúcar', 'quit', 21, date '2026-08-03', '{0,1,2,3,4,5,6}');

-- Lun 3 y mar 4 limpios. Mié 5 en blanco.
insert into public.habit_logs (habit_id, user_id, log_date, status) values
  ('c9c9c9c9-c9c9-c9c9-c9c9-c9c9c9c9c9c9', 'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9', '2026-08-03', 'success'),
  ('c9c9c9c9-c9c9-c9c9-c9c9-c9c9c9c9c9c9', 'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9', '2026-08-04', 'success');

\echo '--- 1. hoy sin marcar no cuenta todavía: el miércoles 5 sigue en 2 ---'
do $$
declare s record;
begin
  select * into s from public.get_habit_stats(
    'c9c9c9c9-c9c9-c9c9-c9c9-c9c9c9c9c9c9', date '2026-08-05');
  if s.clean_days <> 2 or s.current_streak <> 2 then
    raise exception 'FALLO: el día en curso sin marcar dio días % racha %', s.clean_days, s.current_streak;
  end if;
  raise notice 'OK: hoy sin marcar, sigue en 2';
end $$;

\echo '--- 2. EL CASO: el jueves 6, con el miércoles en blanco, el reto está en 0 ---'
do $$
declare s record;
begin
  select * into s from public.get_habit_stats(
    'c9c9c9c9-c9c9-c9c9-c9c9-c9c9c9c9c9c9', date '2026-08-06');
  if s.clean_days <> 0 or s.current_streak <> 0 then
    raise exception 'FALLO: con el miércoles en blanco dio días % racha %', s.clean_days, s.current_streak;
  end if;
  if s.best_streak <> 2 then
    raise exception 'FALLO: la mejor racha salió %, se esperaba 2', s.best_streak;
  end if;
  -- Tocaban 3 días cerrados (3, 4, 5), 2 limpios -> 67%.
  if s.completion_rate <> 67 then
    raise exception 'FALLO: el cumplimiento salió %, se esperaba 67', s.completion_rate;
  end if;
  raise notice 'OK: reto en 0, mejor racha 2, cumplimiento 67%%';
end $$;

\echo '--- 3. marcar el jueves arranca de nuevo: 1 de 21 ---'
insert into public.habit_logs (habit_id, user_id, log_date, status) values
  ('c9c9c9c9-c9c9-c9c9-c9c9-c9c9c9c9c9c9', 'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9', '2026-08-06', 'success');
do $$
declare s record;
begin
  select * into s from public.get_habit_stats(
    'c9c9c9c9-c9c9-c9c9-c9c9-c9c9c9c9c9c9', date '2026-08-06');
  if s.clean_days <> 1 or s.best_streak <> 2 then
    raise exception 'FALLO: tras marcar el jueves dio días % mejor %', s.clean_days, s.best_streak;
  end if;
  raise notice 'OK: día uno otra vez, mejor racha intacta';
end $$;

\echo '--- 4. un día limpio en un día que no tocaba no avanza el reto ---'
insert into public.habits
  (id, user_id, name, kind, target_days, start_date, active_dows)
values ('d9d9d9d9-d9d9-d9d9-d9d9-d9d9d9d9d9d9',
        'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9',
        'Gimnasio', 'build', 21, date '2026-08-03', '{1,3,5}');
-- Lun 3 hecho, mar 4 hecho "igual" (no tocaba), mié 5 hecho.
insert into public.habit_logs (habit_id, user_id, log_date, status) values
  ('d9d9d9d9-d9d9-d9d9-d9d9-d9d9d9d9d9d9', 'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9', '2026-08-03', 'success'),
  ('d9d9d9d9-d9d9-d9d9-d9d9-d9d9d9d9d9d9', 'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9', '2026-08-04', 'success'),
  ('d9d9d9d9-d9d9-d9d9-d9d9-d9d9d9d9d9d9', 'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9', '2026-08-05', 'success');
do $$
declare r integer;
begin
  select clean_days into r from public.get_habit_stats(
    'd9d9d9d9-d9d9-d9d9-d9d9-d9d9d9d9d9d9', date '2026-08-06');
  if r <> 2 then
    raise exception 'FALLO: lun + mar(libre) + mié dio %, se esperaba 2', r;
  end if;
  raise notice 'OK: el martes libre no suma ni resta; va en 2';
end $$;

\echo '--- 5. huecos_pendientes ya no existe ---'
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'huecos_pendientes'
  ) then
    raise exception 'FALLO: huecos_pendientes sigue en el esquema';
  end if;
  raise notice 'OK: sin huecos_pendientes';
end $$;

\echo '--- 6. get_daily_overview ya no trae pendientes y sí el número que vuelve a cero ---'
grant select on public.habits, public.habit_logs to app_user;
set request.jwt.claim.sub = 'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9';
set role app_user;
do $$
declare d integer; hay boolean;
begin
  select pg_get_function_result('public.get_daily_overview(date)'::regprocedure)
         like '%pendientes%' into hay;
  if hay then
    raise exception 'FALLO: get_daily_overview sigue devolviendo pendientes';
  end if;
  select clean_days into d from public.get_daily_overview(date '2026-08-06')
  where habit_id = 'c9c9c9c9-c9c9-c9c9-c9c9-c9c9c9c9c9c9';
  if d <> 1 then
    raise exception 'FALLO: el overview enseña % días', d;
  end if;
  raise notice 'OK: overview sin pendientes, 1 de 21';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

\echo '--- 7. el aviso de la noche cuenta los hábitos sin marcar hoy ---'
update public.profiles set timezone = 'UTC', reminder_hour = 21
where id = 'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9';
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9', 'https://fcm.test/lola', 'k', 'a');
do $$
declare d integer;
begin
  select dato into d from public.avisos_pendientes()
  where user_id = 'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9' and kind = 'dia';
  if d is not null and d < 0 then
    raise exception 'FALLO: el aviso de día salió con dato %', d;
  end if;
  raise notice 'OK: avisos_pendientes corre sin huecos';
end $$;

delete from auth.users where id = 'a9a9a9a9-a9a9-a9a9-a9a9-a9a9a9a9a9a9';
