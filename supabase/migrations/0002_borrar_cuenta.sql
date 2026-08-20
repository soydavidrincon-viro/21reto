-- Borrar la propia cuenta sin pasar por la service_role key.
--
-- Eliminar de auth.users pide privilegios que el cliente no tiene, y la
-- alternativa habitual —mandar la service_role key a algún backend— pone en
-- circulación una llave que se salta todas las políticas. Con SECURITY DEFINER
-- la función corre con los permisos de su dueño pero solo puede borrar la fila
-- de quien la invoca: el id no es un parámetro, sale de auth.uid().
--
-- El resto de las tablas cuelgan de auth.users con ON DELETE CASCADE, así que
-- perfil, hábitos, registros y bitácora se van con la cuenta.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  quien uuid := (select auth.uid());
begin
  if quien is null then
    raise exception 'No hay sesión activa.' using errcode = '28000';
  end if;

  delete from auth.users where id = quien;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
