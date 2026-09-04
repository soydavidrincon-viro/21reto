\set ON_ERROR_STOP on
\pset pager off

-- Pruebas de la política de recaída y del cumplimiento.
--
-- Lo que se comprueba es que la pregunta del alta signifique algo: que
-- "sigo contando" y "vuelvo a empezar de cero" den resultados distintos sobre
-- exactamente los mismos registros. Antes daban lo mismo.
--
-- Usuarios propios; los ficheros anteriores borran los suyos al probar
-- cascadas. Aquí es Gabi.

insert into auth.users (id, email) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'gabi@antidoto.test');

-- Dos hábitos idénticos salvo en la política. Agosto de 2026: el 3 es lunes.
insert into public.habits
  (id, user_id, name, kind, target_days, start_date, active_dows, relapse_policy)
values
  ('c1111111-1111-1111-1111-111111111111',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'Sigo contando', 'quit', 21, date '2026-08-03', '{0,1,2,3,4,5,6}', 'continue'),
  ('c2222222-2222-2222-2222-222222222222',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'Vuelvo a cero', 'quit', 21, date '2026-08-03', '{0,1,2,3,4,5,6}', 'reset');

-- Mismos días en los dos: limpio, limpio, RECAÍDA, limpio, limpio.
insert into public.habit_logs (habit_id, user_id, log_date, status)
select h, 'cccccccc-cccc-cccc-cccc-cccccccccccc', d::date, s
from (values
  (date '2026-08-03', 'success'),
  (date '2026-08-04', 'success'),
  (date '2026-08-05', 'relapse'),
  (date '2026-08-06', 'success'),
  (date '2026-08-07', 'success')
) as v(d, s)
cross join (values
  ('c1111111-1111-1111-1111-111111111111'::uuid),
  ('c2222222-2222-2222-2222-222222222222'::uuid)
) as k(h);

\echo '--- 1. EL CASO: la política cambia la racha sobre los mismos registros ---'
\echo '    "sigo contando" espera 4 (la recaída no parte). "vuelvo a cero" espera 2.'
do $$
declare sigue integer; cero integer;
begin
  select current_streak into sigue
  from public.get_habit_stats('c1111111-1111-1111-1111-111111111111', date '2026-08-07');
  select current_streak into cero
  from public.get_habit_stats('c2222222-2222-2222-2222-222222222222', date '2026-08-07');

  if sigue <> 4 then
    raise exception 'FALLO: con "sigo contando" la racha salió %, se esperaba 4', sigue;
  end if;
  if cero <> 2 then
    raise exception 'FALLO: con "vuelvo a cero" la racha salió %, se esperaba 2', cero;
  end if;
  raise notice 'OK: sigo contando = 4, vuelvo a cero = 2. La opción significa algo.';
end $$;

\echo '--- 2. la mejor racha también respeta la política (4 vs 2) ---'
select
  (select best_streak from public.get_habit_stats('c1111111-1111-1111-1111-111111111111', date '2026-08-07')) as sigo_contando,
  (select best_streak from public.get_habit_stats('c2222222-2222-2222-2222-222222222222', date '2026-08-07')) as vuelvo_a_cero;

\echo '--- 3. un día sin marcar es un hueco: pausa la racha, no la rompe (esperado: 4) ---'
\echo '    (el 9 de agosto, con el 8 en blanco)'
do $$
declare r integer;
begin
  select current_streak into r
  from public.get_habit_stats('c1111111-1111-1111-1111-111111111111', date '2026-08-09');
  if r <> 4 then
    raise exception 'FALLO: un día en blanco dejó la racha en %, se esperaba 4', r;
  end if;
  raise notice 'OK: el hueco pausa; la racha sigue en 4';
end $$;

\echo '--- 4. cumplimiento sobre los días que tocaban, no sobre los registrados ---'
\echo '    5 días transcurridos (3 al 7), 4 limpios -> 80%'
do $$
declare c integer;
begin
  select completion_rate into c
  from public.get_habit_stats('c1111111-1111-1111-1111-111111111111', date '2026-08-07');
  if c <> 80 then
    raise exception 'FALLO: el cumplimiento salió %, se esperaba 80', c;
  end if;
  raise notice 'OK: 4 de 5 = 80%%';
end $$;

\echo '--- 5. abandonar la app baja el cumplimiento (antes se quedaba igual) ---'
\echo '    dos semanas después sin tocar nada: 4 limpios de 19 días -> 21%'
do $$
declare c integer;
begin
  select completion_rate into c
  from public.get_habit_stats('c1111111-1111-1111-1111-111111111111', date '2026-08-21');
  if c >= 80 then
    raise exception 'FALLO: tras dos semanas sin marcar el cumplimiento sigue en %', c;
  end if;
  raise notice 'OK: bajó a %%%, los días sin marcar cuentan como fallados', c;
end $$;

\echo '--- 6. hoy sin marcar no cuenta todavía como fallado ---'
\echo '    (el 8, con el 8 aún en blanco, sigue midiendo sobre 5 días: 80%)'
do $$
declare c integer;
begin
  select completion_rate into c
  from public.get_habit_stats('c1111111-1111-1111-1111-111111111111', date '2026-08-08');
  if c <> 80 then
    raise exception 'FALLO: el día en curso ya contaba como fallado (salió %%%)', c;
  end if;
  raise notice 'OK: el día en curso no se suspende hasta que termina';
end $$;

\echo '--- 7. un hábito recién creado no sale con 0%% de castigo ---'
insert into public.habits (id, user_id, name, target_days, start_date, relapse_policy)
values ('c3333333-3333-3333-3333-333333333333',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'Recién creado', 21, date '2026-08-20', 'continue');
do $$
declare c integer; e integer;
begin
  select completion_rate, current_streak into c, e
  from public.get_habit_stats('c3333333-3333-3333-3333-333333333333', date '2026-08-20');
  if c <> 0 or e <> 0 then
    raise exception 'FALLO: hábito nuevo salió cumplimiento=% racha=%', c, e;
  end if;
  raise notice 'OK: sin días transcurridos, ni premio ni castigo';
end $$;

\echo '--- 8. los días de la semana siguen respetándose junto con la política ---'
insert into public.habits
  (id, user_id, name, kind, target_days, start_date, active_dows, relapse_policy)
values ('c4444444-4444-4444-4444-444444444444',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'Gimnasio', 'build', 21, date '2026-08-03', '{1,3,5}', 'continue');
insert into public.habit_logs (habit_id, user_id, log_date, status) values
  ('c4444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-08-03', 'success'),
  ('c4444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-08-05', 'relapse'),
  ('c4444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-08-07', 'success');
do $$
declare r integer; c integer;
begin
  select current_streak, completion_rate into r, c
  from public.get_habit_stats('c4444444-4444-4444-4444-444444444444', date '2026-08-07');
  -- Lun limpio, mié recaída (perdonada), vie limpio -> racha 2.
  -- Tocaban 3 días (lun, mié, vie), 2 limpios -> 67%.
  if r <> 2 then
    raise exception 'FALLO: lun/mié/vie con recaída perdonada dio racha %, se esperaba 2', r;
  end if;
  if c <> 67 then
    raise exception 'FALLO: el cumplimiento salió %, se esperaba 67', c;
  end if;
  raise notice 'OK: días de la semana y política de recaída conviven';
end $$;
