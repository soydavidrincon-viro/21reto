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

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
                     -f supabase/tests/00-shim-supabase.sql \
                     -f supabase/migrations/0001_init.sql \
                     -f supabase/migrations/0002_borrar_cuenta.sql \
                     -f supabase/migrations/0003_companero.sql \
                     -f supabase/migrations/0005_antojos.sql \
                     -f supabase/migrations/0006_dias_del_habito.sql \
                     -f supabase/migrations/0007_recaida_y_cumplimiento.sql \
                     -f supabase/migrations/0008_recordatorios.sql \
                     -f supabase/migrations/0009_auditoria.sql \
                     -f supabase/migrations/0010_racha_en_pausa.sql \
                     -f supabase/seed.sql \
                     -f supabase/tests/01-esquema.sql \
                     -f supabase/tests/02-antojos.sql \
                     -f supabase/tests/03-dias-del-habito.sql \
                     -f supabase/tests/04-recaida-y-cumplimiento.sql \
                     -f supabase/tests/05-recordatorios.sql \
                     -f supabase/tests/06-auditoria.sql \
                     -f supabase/tests/07-racha-en-pausa.sql
```

La base tiene que estar vacía y el rol `app_user` no debe existir de antes:
`01-esquema.sql` lo crea. Para repetir la corrida, `dropdb` + `drop role
app_user` + `createdb`.

`0004_avatares.sql` se queda fuera a propósito: solo crea el bucket de Storage,
y el esquema `storage` no existe fuera de Supabase. El único trozo de `0009` que
toca `storage` va dentro de un `if exists` por la misma razón.

Los ficheros a partir de `02` corren después de `01-esquema.sql` y reutilizan
el rol `app_user` que aquel deja creado. Los usuarios sí son propios de cada
fichero: los anteriores terminan probando cascadas de borrado, así que sus
usuarios ya no existen cuando arranca el siguiente. Cuidado con los ids: son
uuids escritos a mano y no pueden repetirse entre ficheros.

`set request.jwt.claim.sub` es de sesión y sobrevive al `reset role`, así que
cada fichero que necesite correr *sin* usuario (los de recordatorios) lo limpia
al empezar con `set_config(..., '', false)`.

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

`03-dias-del-habito.sql` prueba los días de la semana: que a quien va al
gimnasio lunes, miércoles y viernes no se le pida marcar el martes, y que un
lunes sin marcar quede como hueco (desde 0010 pausa la racha, no la rompe).

`04-recaida-y-cumplimiento.sql` comprueba que "sigo contando" y "vuelvo a
empezar" den rachas distintas sobre los mismos registros, y que el cumplimiento
se mida contra los días que tocaban y no contra los que se marcaron.

`05-recordatorios.sql` fija instantes concretos para comprobar que la hora del
aviso es la de cada quien, que el tope de uno al día lo impone la llave primaria
y que nadie con sesión puede listar los avisos de todos.

`06-auditoria.sql` cubre lo que cerró la migración 0009: el upsert del
dispositivo funciona para el dueño y queda bloqueado para cualquier otro, una
zona horaria inventada no entra en el perfil, y un registro con fecha futura no
cuenta para la racha.

`07-racha-en-pausa.sql` cubre la regla de 0010: un día sin marcar pausa la
racha y no la rompe; la recaída rompe solo con "vuelvo a cero"; los huecos de
los últimos siete días se listan de viejo a nuevo y contestarlos los quita; los
días que no tocan no son huecos; y `get_daily_overview` trae el porqué y los
huecos. Los tests 01, 03 y 04 se actualizaron a esa regla.
