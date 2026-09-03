# Pruebas del esquema

Comprueban contra un Postgres real lo que no se puede comprobar leyendo:
que el trigger cree el perfil, que las rachas se calculen bien, que la frase
del día sea estable, y que las políticas RLS aislen de verdad a un usuario de
otro.

Contra el Supabase local:

```bash
npx supabase start
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -f supabase/tests/01-esquema.sql
```

Contra un Postgres cualquiera, aplicando antes el shim que remeda el esquema
`auth` de Supabase:

```bash
createuser -s authenticated; createuser -s anon   # los roles que crea Supabase

psql "$DATABASE_URL" -f supabase/tests/00-shim-supabase.sql \
                     -f supabase/migrations/0001_init.sql \
                     -f supabase/migrations/0002_borrar_cuenta.sql \
                     -f supabase/migrations/0003_companero.sql \
                     -f supabase/migrations/0005_antojos.sql \
                     -f supabase/migrations/0006_videos.sql \
                     -f supabase/seed.sql \
                     -f supabase/tests/01-esquema.sql \
                     -f supabase/tests/02-antojos.sql \
                     -f supabase/tests/03-videos.sql
```

`0004_avatares.sql` se queda fuera a propósito: solo crea el bucket de Storage,
y el esquema `storage` no existe fuera de Supabase.

`02-antojos.sql` y `03-videos.sql` corren después de `01-esquema.sql` y
reutilizan el rol `app_user` que aquel deja creado. Los usuarios sí son propios
de cada fichero: los dos anteriores terminan probando cascadas de borrado, así
que sus usuarios ya no existen cuando arranca el siguiente.

Los casos que fallan cortan la corrida con `raise exception`. Los que pasan
imprimen `OK:` o la tabla con el valor esperado escrito al lado en el `\echo`.

El caso 7 existe por un agujero real que encontramos aquí: con una llave
foránea simple sobre `habit_id`, la política de escritura solo verificaba que
`user_id` fuera el de quien escribe, así que cualquiera podía colgar registros
del hábito de otra persona. La llave compuesta `(habit_id, user_id)` lo cierra
en el esquema, donde ninguna política puede olvidarlo.

`02-antojos.sql` repite ahí el mismo caso con la tabla de antojos, más los
límites del esquema (intensidad fuera de 1..5, disparador inventado) y las dos
cascadas: borrar el hábito se lleva sus antojos y deja vivos los sueltos;
borrar la cuenta se los lleva todos.

`03-videos.sql` lo repite una tercera vez con los videos de un hábito, y añade
lo suyo: que el `check` de `url` rechace un `javascript:` —esa columna acaba en
un `href` que la app pinta como enlace— y que un video no pueda existir sin
hábito, al revés que un antojo suelto.
