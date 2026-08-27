-- Foto de perfil.
--
-- El bucket es público de lectura pero cada quien solo escribe en su propia
-- carpeta: el nombre del archivo empieza por el id del usuario y las políticas
-- lo comprueban. Sin eso, cualquiera con la llave pública podría sobrescribir
-- la foto de otro.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatares',
  'avatares',
  true,
  5242880,                                    -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lectura abierta: la foto se muestra en la app y el bucket es público.
drop policy if exists "avatares: lectura pública" on storage.objects;
create policy "avatares: lectura pública" on storage.objects
  for select using (bucket_id = 'avatares');

-- Escritura solo dentro de la carpeta propia. storage.foldername() devuelve el
-- camino partido; el primer tramo tiene que ser el id de quien sube.
drop policy if exists "avatares: subir la propia" on storage.objects;
create policy "avatares: subir la propia" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatares: reemplazar la propia" on storage.objects;
create policy "avatares: reemplazar la propia" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatares: borrar la propia" on storage.objects;
create policy "avatares: borrar la propia" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
