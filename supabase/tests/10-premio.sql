\set ON_ERROR_STOP on
\pset pager off

-- Pruebas del premio (migración 0013): la columna existe con su tope,
-- get_daily_overview la trae, y sin premio viene nula.

reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email) values
  ('b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 'mara@antidoto.test');

\echo '--- 1. el premio cabe en 200 y no en 201 ---'
insert into public.habits (id, user_id, name, target_days, start_date, reward)
values ('c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0',
        'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0',
        'Sin redes', 21, date '2026-08-03', repeat('a', 200));
do $$
begin
  begin
    update public.habits set reward = repeat('a', 201)
    where id = 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0';
    raise exception 'FALLO: se guardó un premio de 201 caracteres';
  exception
    when check_violation then
      raise notice 'OK: 200 sí, 201 no';
  end;
end $$;

\echo '--- 2. get_daily_overview trae el premio, y nulo cuando no hay ---'
insert into public.habits (id, user_id, name, target_days, start_date)
values ('d0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0',
        'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0',
        'Sin azúcar', 21, date '2026-08-03');
grant select on public.habits, public.habit_logs to app_user;
set request.jwt.claim.sub = 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0';
set role app_user;
do $$
declare con text; sin text;
begin
  select premio into con from public.get_daily_overview(date '2026-08-03')
  where habit_id = 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0';
  select premio into sin from public.get_daily_overview(date '2026-08-03')
  where habit_id = 'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0';
  if con <> repeat('a', 200) or sin is not null then
    raise exception 'FALLO: premio con = "%", sin = "%"', left(con, 10), sin;
  end if;
  raise notice 'OK: el overview trae el premio, y nulo sin él';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

delete from auth.users where id = 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0';
