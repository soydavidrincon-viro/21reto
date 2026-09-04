\set ON_ERROR_STOP on
\pset pager off

-- Pruebas de lo que cerró la migración 0009. Cada caso reproduce primero lo
-- que fallaba, para que si alguien deshace la migración esto se ponga rojo.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email) values
  ('a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6', 'fer@antidoto.test'),
  ('b6b6b6b6-b6b6-b6b6-b6b6-b6b6b6b6b6b6', 'gabi@antidoto.test');

grant select, insert, update, delete on public.push_subscriptions to app_user;

\echo '--- 1. volver a guardar el mismo dispositivo actualiza en vez de fallar ---'
set request.jwt.claim.sub = 'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6';
set role app_user;
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
values ('a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6', 'https://fcm.test/fer', 'k1', 'a1', 'v1');

-- Lo que hace la app al reactivar: mismo endpoint, claves nuevas.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
values ('a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6', 'https://fcm.test/fer', 'k2', 'a2', 'v2')
on conflict (endpoint) do update
  set p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;

do $$
declare claves text;
begin
  select p256dh || '/' || user_agent into claves
  from public.push_subscriptions where endpoint = 'https://fcm.test/fer';
  if claves is distinct from 'k2/v2' then
    raise exception 'FALLO: el upsert no actualizó la fila (quedó %)', claves;
  end if;
  raise notice 'OK: el upsert del dispositivo actualiza la fila propia';
end $$;

\echo '--- 2. y nadie puede quedarse con el endpoint de otra persona ---'
set request.jwt.claim.sub = 'b6b6b6b6-b6b6-b6b6-b6b6-b6b6b6b6b6b6';
do $$
begin
  begin
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('b6b6b6b6-b6b6-b6b6-b6b6-b6b6b6b6b6b6', 'https://fcm.test/fer', 'x', 'x')
    on conflict (endpoint) do update
      set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
    raise exception 'FALLO: Gabi se quedó con el dispositivo de Fer';
  exception
    when insufficient_privilege then
      raise notice 'OK: el upsert sobre un endpoint ajeno queda bloqueado';
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

do $$
declare duena uuid;
begin
  select user_id into duena from public.push_subscriptions
  where endpoint = 'https://fcm.test/fer';
  if duena <> 'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6' then
    raise exception 'FALLO: el endpoint cambió de dueño';
  end if;
end $$;

\echo '--- 3. una zona horaria inventada no entra en el perfil ---'
do $$
begin
  begin
    update public.profiles set timezone = 'Marte/Olympus'
    where id = 'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6';
    raise exception 'FALLO: entró una zona horaria que no existe';
  exception
    when invalid_parameter_value then
      raise notice 'OK: zona desconocida rechazada';
  end;
  begin
    update public.profiles set timezone = ''
    where id = 'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6';
    raise exception 'FALLO: entró una zona horaria vacía';
  exception
    when invalid_parameter_value then
      raise notice 'OK: zona vacía rechazada';
  end;
end $$;

update public.profiles set timezone = 'America/Mexico_City'
where id = 'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6';

\echo '--- 4. y con eso avisos_pendientes() ya no puede reventar por un perfil ---'
do $$
declare n integer;
begin
  select count(*) into n from public.avisos_pendientes();
  raise notice 'OK: avisos_pendientes() corre con todos los perfiles (% avisos)', n;
end $$;

\echo '--- 5. un registro con fecha futura no cuenta para la racha ---'
insert into public.habits (id, user_id, name, target_days, start_date, relapse_policy)
values ('c6c6c6c6-c6c6-c6c6-c6c6-c6c6c6c6c6c6',
        'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6',
        'Sin azúcar', 21, date '2026-08-01', 'reset');

-- Tres días limpios de verdad y uno en 2099.
insert into public.habit_logs (habit_id, user_id, log_date, status) values
  ('c6c6c6c6-c6c6-c6c6-c6c6-c6c6c6c6c6c6', 'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6', date '2026-08-01', 'success'),
  ('c6c6c6c6-c6c6-c6c6-c6c6-c6c6c6c6c6c6', 'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6', date '2026-08-02', 'success'),
  ('c6c6c6c6-c6c6-c6c6-c6c6-c6c6c6c6c6c6', 'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6', date '2026-08-03', 'success'),
  ('c6c6c6c6-c6c6-c6c6-c6c6-c6c6c6c6c6c6', 'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6', date '2099-01-01', 'success');

do $$
declare s record;
begin
  select * into s from public.get_habit_stats('c6c6c6c6-c6c6-c6c6-c6c6-c6c6c6c6c6c6', date '2026-08-03');
  if s.clean_days <> 3 or s.current_streak <> 3 or s.best_streak <> 3 then
    raise exception 'FALLO: el registro de 2099 se coló (limpios %, racha %, mejor %)',
      s.clean_days, s.current_streak, s.best_streak;
  end if;
  raise notice 'OK: 3 limpios, racha 3, mejor 3. El día de 2099 no existe todavía.';
end $$;

\echo '--- 6. el cumplimiento por semana sale de SQL con las mismas reglas ---'
\echo '    2026-08-03 es lunes. Semana 1: sáb 1 y dom 2 marcados = 2/2.'
\echo '    Semana 2: solo el lunes 3, ya marcado = 1/1. El de 2099 no existe.'
set request.jwt.claim.sub = 'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6';
set role app_user;
do $$
declare filas text;
begin
  select string_agg(semana || ':' || esperados || '/' || cumplidos, ' ' order by semana)
  into filas
  from public.cumplimiento_semanal(date '2026-08-03', 2);
  if filas is distinct from '0:2/2 1:1/1' then
    raise exception 'FALLO: cumplimiento_semanal devolvió "%"', filas;
  end if;
  raise notice 'OK: 2/2 y 1/1, con hoy contando solo porque ya está marcado';
end $$;

\echo '--- 7. y sin marcar hoy, hoy no cuenta todavía ---'
delete from public.habit_logs
where habit_id = 'c6c6c6c6-c6c6-c6c6-c6c6-c6c6c6c6c6c6' and log_date = date '2026-08-03';
do $$
declare filas text;
begin
  select string_agg(semana || ':' || esperados || '/' || cumplidos, ' ' order by semana)
  into filas
  from public.cumplimiento_semanal(date '2026-08-03', 2);
  if filas is distinct from '0:2/2 1:0/0' then
    raise exception 'FALLO: cumplimiento_semanal devolvió "%"', filas;
  end if;
  raise notice 'OK: el día en curso no suspende a nadie a las ocho de la mañana';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

\echo '--- 8. cascada: borrar la cuenta se lleva también los dispositivos ---'
delete from auth.users where id = 'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6';
delete from auth.users where id = 'b6b6b6b6-b6b6-b6b6-b6b6-b6b6b6b6b6b6';
select count(*) as dispositivos_huerfanos from public.push_subscriptions
where endpoint = 'https://fcm.test/fer';
