@AGENTS.md

# Antídoto

App de trackeo de hábitos para dejar un mal hábito, un día a la vez. Web
instalable (PWA) en lenguaje visual de iOS, con Supabase detrás. El plan vive en
`docs/PLAN.md` y los mockups en `design/`.

## Dos reglas que no se rompen

**El día lo decide el usuario, no el servidor.** Toda fecha sale de
`todayIn(profile.timezone)` (`src/lib/dates.ts`). Nunca uses `now()` ni
`current_date` de Postgres para decidir a qué día pertenece un registro: quien
marca a las 23:40 en Ciudad de México vería su check caer en el día siguiente y
perdería la racha sin haber hecho nada mal. Las funciones SQL reciben la fecha
como parámetro justamente por esto.

**La recaída no se castiga.** Se guarda en amarillo (`--c-yellow`), nunca en
rojo, y no borra los días acumulados. El rojo queda reservado para acciones
destructivas como eliminar la cuenta. El copy trata la recaída como un dato del
proceso, no como una falta.

## Cómo se trabaja aquí

Antes de cada push: `npm run typecheck && npm run lint && npm run build`.

El esquema tiene pruebas de verdad en `supabase/tests/` — corren contra un
Postgres real y cubren rachas, aislamiento entre cuentas y borrado en cascada.
Si tocas `supabase/migrations/`, córrelas y regenera `setup-completo.sql`:

```bash
cat supabase/migrations/*.sql supabase/seed.sql > supabase/setup-completo.sql
```

Los colores y tipografías salen de los tokens de `src/app/globals.css`. Son los
colores de sistema de iOS y el system font stack, que en iPhone resuelve a SF
Pro real. No metas fuentes de Google ni hex sueltos en los componentes.
