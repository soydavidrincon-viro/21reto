\set ON_ERROR_STOP on
\pset pager off

-- Pruebas de a quién le toca aviso.
--
-- Lo que se comprueba es lo que puede salir caro: que nadie reciba dos avisos
-- el mismo día, que la hora sea la SUYA y no la del servidor, y que quien no
-- pidió avisos no reciba ninguno.
--
-- Los momentos se fijan con `set timezone` y una hora concreta, porque estas
-- funciones dependen de now() y sin fijarlo la prueba pasaría o fallaría según
-- a qué hora se corriera.

insert into auth.users (id, email) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'hugo@antidoto.test'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ines@antidoto.test');

-- Hugo en Bogotá (UTC-5) quiere el aviso a las 21:00 suyas.
-- Inés en Madrid (UTC+2 en agosto) también a las 21:00 suyas.
-- A la misma hora UTC no les toca a los dos: esa es la prueba.
update public.profiles set timezone = 'America/Bogota', reminder_hour = 21
where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
update public.profiles set timezone = 'Europe/Madrid', reminder_hour = 21
where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'https://fcm.test/hugo', 'k', 'a'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'https://fcm.test/ines', 'k', 'a');

insert into public.habits (id, user_id, name, target_days, start_date) values
  ('d1111111-1111-1111-1111-111111111111',
   'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Sin alcohol', 21, date '2026-08-01'),
  ('e1111111-1111-1111-1111-111111111111',
   'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Sin redes', 21, date '2026-08-01');

\echo '--- 1. LA REGLA DE LA APP: la hora es la de cada quien, no la del servidor ---'
\echo '    A las 02:00 UTC son las 21:00 en Bogotá y las 04:00 en Madrid.'
\echo '    Esperado: solo Hugo.'
begin;
set local timezone = 'UTC';
select set_config('request.jwt.claim.sub', '', true);
do $$
declare quienes text;
begin
  -- Se simula el instante moviendo now() con un savepoint no es posible, así
  -- que se comprueba la aritmética que usa la función: la hora local de cada
  -- perfil a partir de un instante UTC dado.
  select string_agg(email, ', ' order by email) into quienes
  from auth.users u
  join public.profiles p on p.id = u.id
  where extract(hour from timezone(p.timezone, timestamptz '2026-08-15 02:00:00+00'))::int
        = p.reminder_hour;

  if quienes is distinct from 'hugo@antidoto.test' then
    raise exception 'FALLO: a las 02:00 UTC le tocaba a "%", se esperaba solo a Hugo', quienes;
  end if;
  raise notice 'OK: 02:00 UTC = 21:00 en Bogotá. Solo Hugo.';
end $$;

\echo '--- 2. y siete horas después le toca a Inés, no a Hugo ---'
do $$
declare quienes text;
begin
  select string_agg(email, ', ' order by email) into quienes
  from auth.users u
  join public.profiles p on p.id = u.id
  where extract(hour from timezone(p.timezone, timestamptz '2026-08-15 19:00:00+00'))::int
        = p.reminder_hour;

  if quienes is distinct from 'ines@antidoto.test' then
    raise exception 'FALLO: a las 19:00 UTC le tocaba a "%", se esperaba solo a Inés', quienes;
  end if;
  raise notice 'OK: 19:00 UTC = 21:00 en Madrid. Solo Inés.';
end $$;
commit;

\echo '--- 3. quien no pidió avisos no aparece nunca ---'
update public.profiles set reminder_hour = null
where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
do $$
declare n integer;
begin
  select count(*) into n from public.avisos_pendientes()
  where user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  if n <> 0 then
    raise exception 'FALLO: Inés apareció con % avisos y tiene los avisos apagados', n;
  end if;
  raise notice 'OK: sin reminder_hour, ni un aviso';
end $$;
update public.profiles set reminder_hour = 21
where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

\echo '--- 4. sin dispositivo suscrito tampoco, aunque tenga hora puesta ---'
delete from public.push_subscriptions
where user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
do $$
declare n integer;
begin
  select count(*) into n from public.avisos_pendientes()
  where user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  if n <> 0 then
    raise exception 'FALLO: Inés apareció sin tener dónde recibir';
  end if;
  raise notice 'OK: sin dispositivo, no se le busca aviso';
end $$;

\echo '--- 5. EL TOPE: un aviso al día, impuesto por el esquema ---'
insert into public.notification_log (user_id, local_date, kind)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', date '2026-08-15', 'dia');
do $$
begin
  begin
    insert into public.notification_log (user_id, local_date, kind)
    values ('dddddddd-dddd-dddd-dddd-dddddddddddd', date '2026-08-15', 'racha');
    raise exception 'FALLO: entró un segundo aviso el mismo día';
  exception
    when unique_violation then
      raise notice 'OK: la llave primaria impide el segundo aviso del día';
  end;
end $$;

\echo '--- 6. y quien ya recibió hoy no vuelve a salir en la lista ---'
do $$
declare n integer;
begin
  select count(*) into n from public.avisos_pendientes()
  where user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
    and local_date = date '2026-08-15';
  if n <> 0 then
    raise exception 'FALLO: Hugo volvió a salir tras haber recibido';
  end if;
  raise notice 'OK: con el aviso del día ya registrado, no se repite';
end $$;

\echo '--- 7. un tipo de aviso apagado no se manda ---'
update public.profiles
set avisa_racha = false, avisa_hito = false, avisa_hora_dificil = false
where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
do $$
declare n integer;
begin
  select count(*) into n from public.avisos_pendientes()
  where user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
    and kind in ('racha', 'hito', 'hora_dificil');
  if n <> 0 then
    raise exception 'FALLO: llegó un aviso de un tipo apagado';
  end if;
  raise notice 'OK: los interruptores apagan de verdad';
end $$;

\echo '--- 8. RLS: nadie con sesión puede preguntar por los avisos de otros ---'
grant select on public.push_subscriptions to app_user;
grant select on public.notification_log to app_user;
set request.jwt.claim.sub = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
set role app_user;
select
  (select count(*) from public.push_subscriptions) as dispositivos_ajenos,
  (select count(*) from public.notification_log)   as avisos_ajenos;

\echo '--- 9. y no puede ni llamar a la función que los lista ---'
do $$
begin
  begin
    perform * from public.avisos_pendientes();
    raise exception 'FALLO: un usuario con sesión pudo listar los avisos de todos';
  exception
    when insufficient_privilege then
      raise notice 'OK: la función está reservada al enviador';
  end;
end $$;
reset role;

\echo '--- 10. cascada: borrar la cuenta se lleva dispositivos y avisos ---'
delete from auth.users where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select
  (select count(*) from public.push_subscriptions
   where user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') as dispositivos,
  (select count(*) from public.notification_log
   where user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') as avisos;
