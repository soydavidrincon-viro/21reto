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
psql "$DATABASE_URL" -f supabase/tests/00-shim-supabase.sql \
                     -f supabase/migrations/0001_init.sql \
                     -f supabase/seed.sql \
                     -f supabase/tests/01-esquema.sql
```

Los casos que fallan cortan la corrida con `raise exception`. Los que pasan
imprimen `OK:` o la tabla con el valor esperado escrito al lado en el `\echo`.

El caso 7 existe por un agujero real que encontramos aquí: con una llave
foránea simple sobre `habit_id`, la política de escritura solo verificaba que
`user_id` fuera el de quien escribe, así que cualquiera podía colgar registros
del hábito de otra persona. La llave compuesta `(habit_id, user_id)` lo cierra
en el esquema, donde ninguna política puede olvidarlo.
