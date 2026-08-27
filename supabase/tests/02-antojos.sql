\set ON_ERROR_STOP on
\pset pager off

-- Pruebas de la tabla de antojos. Se corren después de 01-esquema.sql, que ya
-- dejó creado el rol app_user y borró sus datos al probar el borrado de cuenta.

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'cami@antidoto.test'),
  ('55555555-5555-5555-5555-555555555555', 'dani@antidoto.test');

grant select, insert, update, delete on public.cravings to app_user;

insert into public.habits (id, user_id, name, target_days, start_date)
values ('66666666-6666-6666-6666-666666666666',
        '44444444-4444-4444-4444-444444444444',
        'Sin celular en la cama', 21, date '2026-08-01');

-- El escenario: a Cami le da sobre todo por estrés y sobre todo los viernes
-- por la noche. Doce antojos, aguantó diez.
--   dow 5 = viernes, hora 21 -> bloque 5 (20-24)
insert into public.cravings
  (user_id, habit_id, local_date, local_hour, local_dow, intensity, trigger_key, resisted)
values
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', '2026-08-07', 21, 5, 4, 'estres', true),
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', '2026-08-07', 22, 5, 5, 'estres', true),
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', '2026-08-14', 20, 5, 3, 'estres', true),
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', '2026-08-14', 23, 5, 5, 'aburrimiento', false),
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', '2026-08-21', 21, 5, 4, 'estres', true),
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', '2026-08-04', 10, 2, 2, 'aburrimiento', true),
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', '2026-08-05', 11, 3, 2, 'aburrimiento', true),
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', '2026-08-06', 15, 4, 3, 'gente', true),
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', '2026-08-11', 16, 2, 3, 'estres', true),
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', '2026-08-12', 9, 3, 1, 'lugar', false),
  -- Uno suelto, sin hábito: tiene que poder existir.
  ('44444444-4444-4444-4444-444444444444', null, '2026-08-13', 14, 4, 2, 'tristeza', true),
  ('44444444-4444-4444-4444-444444444444', null, '2026-08-18', 19, 2, 3, null, true);

\echo '--- 1. resumen (esperado: 12 total, 10 aguantados, 2 caídas, estres 5, viernes bloque 5 con 5) ---'
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
set role app_user;
select total, resisted, caved, top_trigger, top_trigger_total, top_dow, top_block, top_block_total
from public.get_craving_summary(date '2026-08-01');

\echo '--- 2. la rejilla agrupa por bloques de cuatro horas (viernes noche: 5 antojos, 4 aguantados) ---'
select dow, block, total, resisted
from public.get_craving_grid(date '2026-08-01')
where dow = 5 and block = 5;

\echo '--- 3. la ventana de fechas recorta de verdad (esperado: menos de 12) ---'
select total from public.get_craving_summary(date '2026-08-15');

\echo '--- 4. RLS: Dani no ve ni un antojo de Cami, ni por la tabla ni por las funciones ---'
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select
  (select count(*) from public.cravings)                                 as antojos_ajenos,
  (select coalesce(sum(total), 0) from public.get_craving_grid(date '2026-08-01')) as rejilla_ajena,
  (select coalesce(total, 0) from public.get_craving_summary(date '2026-08-01'))   as resumen_ajeno;

\echo '--- 5. RLS de escritura: Dani no puede colgar un antojo del hábito de Cami ---'
do $$
begin
  insert into public.cravings
    (user_id, habit_id, local_date, local_hour, local_dow, intensity)
  values ('55555555-5555-5555-5555-555555555555',
          '66666666-6666-6666-6666-666666666666',
          '2026-08-20', 12, 4, 3);
  raise exception 'FALLO: Dani colgó un antojo del hábito de Cami';
exception
  when foreign_key_violation then
    raise notice 'OK: bloqueado por la llave compuesta (habit_id, user_id)';
  when insufficient_privilege then
    raise notice 'OK: bloqueado por RLS';
end $$;

\echo '--- 6. RLS de escritura: Dani tampoco puede firmar un antojo como Cami ---'
do $$
begin
  insert into public.cravings
    (user_id, habit_id, local_date, local_hour, local_dow, intensity)
  values ('44444444-4444-4444-4444-444444444444', null, '2026-08-20', 12, 4, 3);
  raise exception 'FALLO: Dani insertó un antojo a nombre de Cami';
exception
  when insufficient_privilege then
    raise notice 'OK: la política de insert lo rechazó';
end $$;

\echo '--- 7. los rangos se validan en el esquema, no solo en el formulario ---'
reset role;
do $$
begin
  insert into public.cravings
    (user_id, local_date, local_hour, local_dow, intensity)
  values ('44444444-4444-4444-4444-444444444444', '2026-08-20', 12, 4, 9);
  raise exception 'FALLO: aceptó intensidad 9';
exception
  when check_violation then raise notice 'OK: intensidad fuera de 1..5 rechazada';
end $$;

do $$
begin
  insert into public.cravings
    (user_id, local_date, local_hour, local_dow, intensity, trigger_key)
  values ('44444444-4444-4444-4444-444444444444', '2026-08-20', 12, 4, 3, 'lo-que-sea');
  raise exception 'FALLO: aceptó un disparador que no existe';
exception
  when check_violation then raise notice 'OK: disparador desconocido rechazado';
end $$;

\echo '--- 8. borrar el hábito se lleva sus antojos, y deja vivos los sueltos (esperado: 2) ---'
delete from public.habits where id = '66666666-6666-6666-6666-666666666666';
select count(*) as antojos_sueltos_que_sobreviven
from public.cravings
where user_id = '44444444-4444-4444-4444-444444444444';

\echo '--- 9. borrar la cuenta se lleva los antojos (esperado: 0) ---'
delete from auth.users where id = '44444444-4444-4444-4444-444444444444';
select count(*) as antojos_restantes from public.cravings;
