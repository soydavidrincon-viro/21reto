\set ON_ERROR_STOP on
\pset pager off

-- Pruebas de los días asumidos (migración 0014).
--
-- Lo que se comprueba: los días que tocaban y quedaron sin marcar se cierran
-- como recaída asumida; hoy no se toca; la cuenta del reto no cambia al
-- cerrarlos; correrla dos veces no duplica; los hábitos que se construyen
-- se cierran igual (la app guarda el día saltado como recaída) y solo en los
-- días que tocan; los de hace más de dos
-- semanas nacen revisados; los archivados y los de otra persona no se tocan;
-- y un registro normal nace sin asumir.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email) values
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'mara@antidoto.test'),
  ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'teo@antidoto.test');

-- Agosto de 2026: el 3 es lunes. Todos los días.
insert into public.habits
  (id, user_id, name, kind, target_days, start_date, active_dows)
values ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
        'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
        'Sin azúcar', 'quit', 21, date '2026-08-03', '{0,1,2,3,4,5,6}');

-- Lun 3 y mar 4 limpios. Del 5 al 7 nada. Hoy es sábado 8.
insert into public.habit_logs (habit_id, user_id, log_date, status) values
  ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', '2026-08-03', 'success'),
  ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', '2026-08-04', 'success');

grant select, insert, update, delete on public.habits, public.habit_logs to app_user;

\echo '--- 1. antes de cerrar: 0 días, mejor 2, cumplimiento 40 ---'
do $$
declare s record;
begin
  select * into s from public.get_habit_stats(
    'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', date '2026-08-08');
  if s.clean_days <> 0 or s.best_streak <> 2 or s.completion_rate <> 40 then
    raise exception 'FALLO: antes de cerrar dio días % mejor % cumplimiento %',
      s.clean_days, s.best_streak, s.completion_rate;
  end if;
  raise notice 'OK: antes de cerrar, 0 / 2 / 40%%';
end $$;

\echo '--- 2. EL CASO: cerrar inserta 5, 6 y 7 como recaída asumida; hoy no ---'
set request.jwt.claim.sub = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1';
set role app_user;
do $$
declare n integer; r record;
begin
  select public.cerrar_dias_sin_marcar(date '2026-08-08') into n;
  if n <> 3 then
    raise exception 'FALLO: cerró % días, se esperaban 3', n;
  end if;
  select count(*) filter (where status = 'relapse' and asumido and revisado_en is null) as asumidos,
         count(*) filter (where log_date = date '2026-08-08') as hoy
  into r
  from public.habit_logs
  where habit_id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'
    and log_date between date '2026-08-05' and date '2026-08-08';
  if r.asumidos <> 3 or r.hoy <> 0 then
    raise exception 'FALLO: asumidos % (3), hoy % (0)', r.asumidos, r.hoy;
  end if;
  raise notice 'OK: 5, 6 y 7 en amarillo, sin revisar; el 8 intacto';
end $$;

\echo '--- 3. la cuenta no cambia al cerrar, y correrla otra vez no duplica ---'
do $$
declare s record; n integer;
begin
  select * into s from public.get_habit_stats(
    'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', date '2026-08-08');
  if s.clean_days <> 0 or s.best_streak <> 2 or s.completion_rate <> 40 then
    raise exception 'FALLO: después de cerrar dio días % mejor % cumplimiento %',
      s.clean_days, s.best_streak, s.completion_rate;
  end if;
  if s.relapses <> 3 then
    raise exception 'FALLO: las recaídas salieron %, se esperaban 3', s.relapses;
  end if;
  select public.cerrar_dias_sin_marcar(date '2026-08-08') into n;
  if n <> 0 then
    raise exception 'FALLO: la segunda corrida cerró % días', n;
  end if;
  raise notice 'OK: misma cuenta, 3 recaídas, segunda corrida en 0';
end $$;

\echo '--- 4. un hábito que se construye, lun-mié-vie: se cierra solo en esos días ---'
insert into public.habits
  (id, user_id, name, kind, target_days, start_date, active_dows)
values ('e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2',
        'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
        'Gimnasio', 'build', 21, date '2026-08-03', '{1,3,5}');
do $$
declare n integer; r record;
begin
  -- Lun 3, mié 5 y vie 7 tocaban. Nada marcado.
  select public.cerrar_dias_sin_marcar(date '2026-08-08') into n;
  if n <> 3 then
    raise exception 'FALLO: el gimnasio cerró % días, se esperaban 3', n;
  end if;
  select count(*) filter (where status = 'relapse' and asumido) as saltados,
         count(*) filter (where extract(dow from log_date) not in (1, 3, 5)) as fuera
  into r
  from public.habit_logs
  where habit_id = 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2';
  if r.saltados <> 3 or r.fuera <> 0 then
    raise exception 'FALLO: saltados % (3), en días libres % (0)', r.saltados, r.fuera;
  end if;
  raise notice 'OK: tres días cerrados, ninguno en martes ni jueves';
end $$;

\echo '--- 5. los de hace más de dos semanas nacen revisados ---'
do $$
declare r record;
begin
  -- Hoy es 25 de agosto. De lo que se cierra ahora, el lun 10 queda a más
  -- de 14 días; del mié 12 en adelante, no. (El 3, 5 y 7 ya se cerraron en
  -- el caso 4 con otro "hoy" y no se tocan.)
  perform public.cerrar_dias_sin_marcar(date '2026-08-25');
  select
    bool_and(revisado_en is not null) filter (where log_date = date '2026-08-10') as viejos,
    bool_and(revisado_en is null) filter (where log_date >= date '2026-08-12') as nuevos
  into r
  from public.habit_logs
  where habit_id = 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2' and asumido;
  if not r.viejos or not r.nuevos then
    raise exception 'FALLO: viejos revisados % / nuevos sin revisar %', r.viejos, r.nuevos;
  end if;
  raise notice 'OK: lo de hace más de dos semanas no se pregunta';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

\echo '--- 6. un hábito archivado no se toca; los de otra persona tampoco ---'
insert into public.habits
  (id, user_id, name, kind, target_days, start_date, active_dows, status)
values ('e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3',
        'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
        'Viejo', 'quit', 21, date '2026-08-03', '{0,1,2,3,4,5,6}', 'archived');
insert into public.habits
  (id, user_id, name, kind, target_days, start_date, active_dows)
values ('e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4',
        'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
        'De Teo', 'quit', 21, date '2026-08-03', '{0,1,2,3,4,5,6}');
set request.jwt.claim.sub = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1';
set role app_user;
do $$
declare r record;
begin
  perform public.cerrar_dias_sin_marcar(date '2026-08-08');
  select
    (select count(*) from public.habit_logs where habit_id = 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3') as archivado,
    (select count(*) from public.habit_logs where habit_id = 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4') as ajeno
  into r;
  if r.archivado <> 0 or r.ajeno <> 0 then
    raise exception 'FALLO: archivado % (0), ajeno % (0)', r.archivado, r.ajeno;
  end if;
  raise notice 'OK: archivado y ajeno intactos';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
-- Sin sesión la función tampoco escribe nada de nadie.
do $$
declare n integer;
begin
  select public.cerrar_dias_sin_marcar(date '2026-08-08') into n;
  if n <> 0 then
    raise exception 'FALLO: sin sesión cerró % días', n;
  end if;
  raise notice 'OK: sin sesión no cierra nada';
end $$;

\echo '--- 7. un registro normal nace sin asumir ---'
do $$
declare a boolean;
begin
  select asumido into a from public.habit_logs
  where habit_id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1' and log_date = date '2026-08-03';
  if a then
    raise exception 'FALLO: el limpio del 3 salió asumido';
  end if;
  raise notice 'OK: lo marcado por la persona no es asumido';
end $$;

delete from auth.users where id in
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2');
