\set ON_ERROR_STOP on
\pset pager off

-- Pruebas de los videos de un hábito. Corren después de 01-esquema.sql, que
-- deja creado el rol app_user.
--
-- Los usuarios son propios y no los de 02-antojos: aquel termina probando las
-- cascadas de borrado, así que para cuando llega este fichero sus usuarios ya
-- no existen. Aquí son Eva (8888…) y Fran (9999…).

insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'eva@antidoto.test'),
  ('99999999-9999-9999-9999-999999999999', 'fran@antidoto.test');

grant select, insert, update, delete on public.habit_videos to app_user;

-- Un hábito de los que se construyen, que es donde la app enseña los videos.
insert into public.habits (id, user_id, name, kind, target_days, start_date)
values ('a8888888-8888-8888-8888-888888888888',
        '88888888-8888-8888-8888-888888888888',
        'Ejercicio', 'build', 21, date '2026-08-01');

insert into public.habit_videos (user_id, habit_id, url, title) values
  ('88888888-8888-8888-8888-888888888888',
   'a8888888-8888-8888-8888-888888888888',
   'https://www.youtube.com/watch?v=abc123', 'Rutina de 15 min'),
  ('88888888-8888-8888-8888-888888888888',
   'a8888888-8888-8888-8888-888888888888',
   'https://vimeo.com/987654', null);

\echo '--- 1. Eva ve sus dos videos, y el que no tiene título lo tiene nulo ---'
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
set role app_user;
select count(*) as videos, count(title) as con_titulo
from public.habit_videos;

\echo '--- 2. RLS de lectura: Fran no ve ni uno (esperado: 0) ---'
set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
select count(*) as videos_ajenos from public.habit_videos;

\echo '--- 3. RLS de escritura: Fran no puede colgar un video del hábito de Eva ---'
do $$
begin
  begin
    insert into public.habit_videos (user_id, habit_id, url)
    values ('99999999-9999-9999-9999-999999999999',
            'a8888888-8888-8888-8888-888888888888',
            'https://www.youtube.com/watch?v=intruso');
    raise exception 'FALLO: Fran colgó un video del hábito de Eva';
  exception
    when insufficient_privilege or foreign_key_violation then
      raise notice 'OK: la llave compuesta y la política lo impiden';
  end;
end $$;

\echo '--- 4. RLS de escritura: Fran tampoco puede firmar como Eva ---'
do $$
begin
  begin
    insert into public.habit_videos (user_id, habit_id, url)
    values ('88888888-8888-8888-8888-888888888888',
            'a8888888-8888-8888-8888-888888888888',
            'https://www.youtube.com/watch?v=suplantado');
    raise exception 'FALLO: Fran escribió un video a nombre de Eva';
  exception
    when insufficient_privilege then
      raise notice 'OK: la política de inserción lo impide';
  end;
end $$;

\echo '--- 5. el esquema rechaza un enlace que no es http(s) ---'
reset role;
do $$
begin
  begin
    insert into public.habit_videos (user_id, habit_id, url)
    values ('88888888-8888-8888-8888-888888888888',
            'a8888888-8888-8888-8888-888888888888',
            'javascript:alert(1)');
    raise exception 'FALLO: entró un enlace javascript:';
  exception
    when check_violation then
      raise notice 'OK: javascript: rechazado por el check de url';
  end;

  begin
    insert into public.habit_videos (user_id, habit_id, url, title)
    values ('88888888-8888-8888-8888-888888888888',
            'a8888888-8888-8888-8888-888888888888',
            'https://www.youtube.com/watch?v=largo',
            repeat('x', 121));
    raise exception 'FALLO: entró un título de más de 120 caracteres';
  exception
    when check_violation then
      raise notice 'OK: título largo rechazado';
  end;
end $$;

\echo '--- 6. un video no puede existir sin hábito (habit_id nulo) ---'
do $$
begin
  begin
    insert into public.habit_videos (user_id, habit_id, url)
    values ('88888888-8888-8888-8888-888888888888', null,
            'https://www.youtube.com/watch?v=huerfano');
    raise exception 'FALLO: entró un video sin hábito';
  exception
    when not_null_violation then
      raise notice 'OK: habit_id es obligatorio';
  end;
end $$;

\echo '--- 7. cascada: borrar el hábito se lleva sus videos (esperado: 0) ---'
delete from public.habits where id = 'a8888888-8888-8888-8888-888888888888';
select count(*) as videos_tras_borrar_habito from public.habit_videos;

\echo '--- 8. cascada: borrar la cuenta se lleva los videos (esperado: 0) ---'
insert into public.habits (id, user_id, name, target_days, start_date)
values ('b8888888-8888-8888-8888-888888888888',
        '88888888-8888-8888-8888-888888888888',
        'Ejercicio', 21, date '2026-08-01');
insert into public.habit_videos (user_id, habit_id, url)
values ('88888888-8888-8888-8888-888888888888',
        'b8888888-8888-8888-8888-888888888888',
        'https://www.youtube.com/watch?v=cuenta');
delete from auth.users where id = '88888888-8888-8888-8888-888888888888';
select count(*) as videos_tras_borrar_cuenta from public.habit_videos;
