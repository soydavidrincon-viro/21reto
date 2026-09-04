\set ON_ERROR_STOP on
\pset pager off

-- Pruebas de la racha en pausa (migración 0010).
--
-- Lo que se comprueba es la promesa: un día sin marcar no rompe la racha,
-- una recaída sí (solo con "vuelvo a empezar"), los huecos se listan durante
-- siete días y contestarlos los saca de la lista.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email) values
  ('a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7', 'hana@antidoto.test');

-- Agosto de 2026: el 3 es lunes. Dos hábitos iguales salvo la política.
insert into public.habits
  (id, user_id, name, kind, target_days, start_date, active_dows, relapse_policy, description)
values
  ('c7c7c7c7-c7c7-c7c7-c7c7-c7c7c7c7c7c7',
   'a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7',
   'Sin alcohol', 'quit', 21, date '2026-08-03', '{0,1,2,3,4,5,6}', 'continue',
   'Por mis hijas'),
  ('d7d7d7d7-d7d7-d7d7-d7d7-d7d7d7d7d7d7',
   'a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7',
   'Sin redes', 'quit', 21, date '2026-08-03', '{0,1,2,3,4,5,6}', 'reset', null);

-- Lun 3, mar 4 limpios; mié 5 EN BLANCO; jue 6 limpio; vie 7 recaída; sáb 8 limpio.
insert into public.habit_logs (habit_id, user_id, log_date, status)
select h, 'a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7', d, s
from (values
  (date '2026-08-03', 'success'),
  (date '2026-08-04', 'success'),
  (date '2026-08-06', 'success'),
  (date '2026-08-07', 'relapse'),
  (date '2026-08-08', 'success')
) as v(d, s)
cross join (values
  ('c7c7c7c7-c7c7-c7c7-c7c7-c7c7c7c7c7c7'::uuid),
  ('d7d7d7d7-d7d7-d7d7-d7d7-d7d7d7d7d7d7'::uuid)
) as k(h);

\echo '--- 1. EL CASO: el miércoles en blanco no rompe la racha ---'
\echo '    El jueves 6, "sigo contando" espera 3 (lun, mar, jue). Antes daba 1.'
do $$
declare r integer;
begin
  select current_streak into r
  from public.get_habit_stats('c7c7c7c7-c7c7-c7c7-c7c7-c7c7c7c7c7c7', date '2026-08-06');
  if r <> 3 then
    raise exception 'FALLO: con un hueco la racha salió %, se esperaba 3', r;
  end if;
  raise notice 'OK: un día sin marcar pausa, no rompe';
end $$;

\echo '--- 2. la recaída con "vuelvo a cero" sí rompe; con "sigo contando" no ---'
\echo '    El sábado 8: sigo contando = 4 limpios; vuelvo a cero = 1 (solo el sábado).'
do $$
declare sigue integer; cero integer; mejor integer;
begin
  select current_streak into sigue
  from public.get_habit_stats('c7c7c7c7-c7c7-c7c7-c7c7-c7c7c7c7c7c7', date '2026-08-08');
  select current_streak, best_streak into cero, mejor
  from public.get_habit_stats('d7d7d7d7-d7d7-d7d7-d7d7-d7d7d7d7d7d7', date '2026-08-08');
  if sigue <> 4 then
    raise exception 'FALLO: "sigo contando" salió %, se esperaba 4', sigue;
  end if;
  if cero <> 1 then
    raise exception 'FALLO: "vuelvo a cero" salió %, se esperaba 1', cero;
  end if;
  if mejor <> 3 then
    raise exception 'FALLO: la mejor racha con "vuelvo a cero" salió %, se esperaba 3', mejor;
  end if;
  raise notice 'OK: sigo contando = 4, vuelvo a cero = 1 con mejor 3';
end $$;

\echo '--- 3. una semana sin abrir la app: la racha sigue donde estaba ---'
do $$
declare r integer; c integer;
begin
  select current_streak, completion_rate into r, c
  from public.get_habit_stats('c7c7c7c7-c7c7-c7c7-c7c7-c7c7c7c7c7c7', date '2026-08-16');
  if r <> 4 then
    raise exception 'FALLO: tras una semana en blanco la racha salió %, se esperaba 4', r;
  end if;
  -- 13 días tocaban (3 al 15; el 16 sin marcar no cuenta aún), 4 limpios -> 31%.
  if c <> 31 then
    raise exception 'FALLO: el cumplimiento salió %, se esperaba 31', c;
  end if;
  raise notice 'OK: la racha se queda en 4 y el cumplimiento sí baja a 31%%';
end $$;

\echo '--- 4. los huecos se listan: los últimos siete días, de viejo a nuevo ---'
\echo '    El 16 de agosto: del 9 al 15 sin registro -> siete huecos. El 5 ya no entra.'
do $$
declare huecos date[];
begin
  select public.huecos_pendientes('c7c7c7c7-c7c7-c7c7-c7c7-c7c7c7c7c7c7', date '2026-08-16')
  into huecos;
  if huecos <> array[date '2026-08-09', '2026-08-10', '2026-08-11', '2026-08-12',
                     '2026-08-13', '2026-08-14', '2026-08-15'] then
    raise exception 'FALLO: los huecos salieron %', huecos;
  end if;
  raise notice 'OK: siete huecos del 9 al 15, y el 5 ya quedó atrás';
end $$;

\echo '--- 5. contestar un hueco lo saca de la lista, y hoy nunca es un hueco ---'
insert into public.habit_logs (habit_id, user_id, log_date, status) values
  ('c7c7c7c7-c7c7-c7c7-c7c7-c7c7c7c7c7c7', 'a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7', '2026-08-09', 'success');
do $$
declare huecos date[];
begin
  select public.huecos_pendientes('c7c7c7c7-c7c7-c7c7-c7c7-c7c7c7c7c7c7', date '2026-08-16')
  into huecos;
  if cardinality(huecos) <> 6 or huecos[1] <> date '2026-08-10' then
    raise exception 'FALLO: tras contestar el 9 quedaron %', huecos;
  end if;
  raise notice 'OK: el 9 contestado desaparece; quedan seis';
end $$;

\echo '--- 6. los días que no tocan no son huecos ---'
insert into public.habits
  (id, user_id, name, kind, target_days, start_date, active_dows, relapse_policy)
values ('e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7',
        'a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7',
        'Gimnasio', 'build', 21, date '2026-08-03', '{1,3,5}', 'continue');
do $$
declare huecos date[];
begin
  -- Del 10 al 16 tocaban lun 10, mié 12, vie 14.
  select public.huecos_pendientes('e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7', date '2026-08-17')
  into huecos;
  if huecos <> array[date '2026-08-10', '2026-08-12', '2026-08-14'] then
    raise exception 'FALLO: los huecos de lun/mié/vie salieron %', huecos;
  end if;
  raise notice 'OK: solo lun, mié y vie cuentan como huecos';
end $$;

\echo '--- 7. get_daily_overview trae el porqué y los huecos ---'
grant select on public.habits, public.habit_logs to app_user;
set request.jwt.claim.sub = 'a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7';
set role app_user;
do $$
declare m text; n integer;
begin
  select motivo, cardinality(pendientes) into m, n
  from public.get_daily_overview(date '2026-08-16')
  where habit_id = 'c7c7c7c7-c7c7-c7c7-c7c7-c7c7c7c7c7c7';
  if m <> 'Por mis hijas' or n <> 6 then
    raise exception 'FALLO: overview devolvió motivo "%" y % huecos', m, n;
  end if;
  raise notice 'OK: motivo y huecos llegan a Hoy';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

\echo '--- 8. el aviso de la noche cuenta los huecos ---'
update public.profiles set timezone = 'UTC', reminder_hour = 21
where id = 'a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7';
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7', 'https://fcm.test/hana', 'k', 'a');
-- No se puede fijar now(), así que solo se comprueba que corre y que, si
-- sale el aviso 'dia' para Hana, trae un dato mayor que cero.
do $$
declare d integer;
begin
  select dato into d from public.avisos_pendientes()
  where user_id = 'a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7' and kind = 'dia';
  if d is not null and d = 0 then
    raise exception 'FALLO: el aviso de día salió con 0 huecos';
  end if;
  raise notice 'OK: avisos_pendientes corre con la columna nueva';
end $$;

delete from auth.users where id = 'a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7';
