\set ON_ERROR_STOP on
\pset pager off

-- Pruebas del reto de cero (migración 0011).
--
-- Lo que se comprueba es que la política guardada ya no manda: una recaída
-- reinicia el reto aunque el hábito diga 'continue', los días del reto son
-- los de después de la última recaída, la mejor racha recuerda el tramo
-- anterior y el cumplimiento sigue midiendo el esfuerzo entero.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email) values
  ('a8a8a8a8-a8a8-a8a8-a8a8-a8a8a8a8a8a8', 'iker@antidoto.test');

\echo '--- 1. el valor por defecto de la columna es reset ---'
insert into public.habits (id, user_id, name, target_days, start_date)
values ('b8b8b8b8-b8b8-b8b8-b8b8-b8b8b8b8b8b8',
        'a8a8a8a8-a8a8-a8a8-a8a8-a8a8a8a8a8a8',
        'Sin azúcar', 21, date '2026-08-03');
do $$
declare p text;
begin
  select relapse_policy into p from public.habits
  where id = 'b8b8b8b8-b8b8-b8b8-b8b8-b8b8b8b8b8b8';
  if p <> 'reset' then
    raise exception 'FALLO: el hábito nació con política %', p;
  end if;
  raise notice 'OK: nace con reset';
end $$;

\echo '--- 2. EL CASO: con ''continue'' guardado, la recaída reinicia igual ---'
\echo '    Lun 3 al jue 6 limpios, vie 7 recaída, sáb 8 y dom 9 limpios.'
\echo '    El domingo 9: días del reto 2, racha 2, mejor 4, 1 recaída.'
insert into public.habits
  (id, user_id, name, kind, target_days, start_date, active_dows, relapse_policy)
values ('c8c8c8c8-c8c8-c8c8-c8c8-c8c8c8c8c8c8',
        'a8a8a8a8-a8a8-a8a8-a8a8-a8a8a8a8a8a8',
        'Sin redes', 'quit', 21, date '2026-08-03', '{0,1,2,3,4,5,6}', 'continue');
insert into public.habit_logs (habit_id, user_id, log_date, status)
select 'c8c8c8c8-c8c8-c8c8-c8c8-c8c8c8c8c8c8', 'a8a8a8a8-a8a8-a8a8-a8a8-a8a8a8a8a8a8', d, s
from (values
  (date '2026-08-03', 'success'),
  (date '2026-08-04', 'success'),
  (date '2026-08-05', 'success'),
  (date '2026-08-06', 'success'),
  (date '2026-08-07', 'relapse'),
  (date '2026-08-08', 'success'),
  (date '2026-08-09', 'success')
) as v(d, s);
do $$
declare s record;
begin
  select * into s from public.get_habit_stats(
    'c8c8c8c8-c8c8-c8c8-c8c8-c8c8c8c8c8c8', date '2026-08-09');
  if s.clean_days <> 2 or s.current_streak <> 2 or s.best_streak <> 4 or s.relapses <> 1 then
    raise exception 'FALLO: días % racha % mejor % recaídas %',
      s.clean_days, s.current_streak, s.best_streak, s.relapses;
  end if;
  -- 7 días tocaban (3 al 9, el 9 ya marcado), 6 limpios en total -> 86%.
  if s.completion_rate <> 86 then
    raise exception 'FALLO: el cumplimiento salió %, se esperaba 86', s.completion_rate;
  end if;
  raise notice 'OK: el reto vuelve a 2, la mejor racha recuerda el 4, el cumplimiento mide todo';
end $$;

\echo '--- 3. el mismo día de la recaída el reto está en cero ---'
do $$
declare s record;
begin
  select * into s from public.get_habit_stats(
    'c8c8c8c8-c8c8-c8c8-c8c8-c8c8c8c8c8c8', date '2026-08-07');
  if s.clean_days <> 0 or s.current_streak <> 0 or s.best_streak <> 4 then
    raise exception 'FALLO: el día de la recaída dio días % racha % mejor %',
      s.clean_days, s.current_streak, s.best_streak;
  end if;
  raise notice 'OK: día de recaída = 0 de 21, mejor 4';
end $$;

\echo '--- 4. el lunes 10 sin marcar reinicia otra vez (desde 0012) ---'
\echo '    El martes 11 con el lunes 10 en blanco: 0. La mejor racha sigue en 4.'
do $$
declare r integer; m integer;
begin
  select clean_days, best_streak into r, m from public.get_habit_stats(
    'c8c8c8c8-c8c8-c8c8-c8c8-c8c8c8c8c8c8', date '2026-08-11');
  if r <> 0 or m <> 4 then
    raise exception 'FALLO: con el lunes en blanco salió % (mejor %), se esperaba 0 (mejor 4)', r, m;
  end if;
  raise notice 'OK: el lunes en blanco reinicia; mejor racha 4';
end $$;

\echo '--- 5. Hoy recibe el número que vuelve a cero ---'
grant select on public.habits, public.habit_logs to app_user;
set request.jwt.claim.sub = 'a8a8a8a8-a8a8-a8a8-a8a8-a8a8a8a8a8a8';
set role app_user;
do $$
declare d integer;
begin
  select clean_days into d from public.get_daily_overview(date '2026-08-09')
  where habit_id = 'c8c8c8c8-c8c8-c8c8-c8c8-c8c8c8c8c8c8';
  if d <> 2 then
    raise exception 'FALLO: el overview enseña % días', d;
  end if;
  raise notice 'OK: el overview enseña 2 de 21';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

delete from auth.users where id = 'a8a8a8a8-a8a8-a8a8-a8a8-a8a8a8a8a8a8';
