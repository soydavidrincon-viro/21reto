@AGENTS.md

# Antídoto

App de trackeo de hábitos para dejar un mal hábito, un día a la vez. Web
instalable (PWA) en lenguaje visual de iOS, con Supabase detrás. El plan vive en
`docs/PLAN.md` y los mockups en `design/`.

## Tres reglas que no se rompen

**El día lo decide el usuario, no el servidor.** Toda fecha sale de
`todayIn(profile.timezone)` (`src/lib/dates.ts`). Nunca uses `now()` ni
`current_date` de Postgres para decidir a qué día pertenece un registro: quien
marca a las 23:40 en Ciudad de México vería su check caer en el día siguiente y
perdería la racha sin haber hecho nada mal. Las funciones SQL reciben la fecha
como parámetro justamente por esto.

**La recaída no se castiga, pero reinicia el reto.** Se guarda en amarillo
(`--c-ambar`), nunca en rojo; el calendario conserva cada día y la mejor racha
recuerda el tramo anterior. El rojo queda reservado para acciones destructivas
como eliminar la cuenta. Desde la migración 0011 no hay política que elegir:
`relapse_policy` sigue en la tabla pero siempre vale `reset` y ninguna función
la consulta. El copy trata la recaída como un dato del proceso, no como una
falta, y dice sin rodeos que el reto vuelve a cero.

**Cada día se marca ese día.** Un día que tocaba y quedó sin marcar reinicia
el reto igual que una recaída; hoy no cuenta hasta que termina, y los días que
no tocan no cuentan nunca. No hay ventana hacia atrás: `markDay` solo acepta
hoy y el calendario del detalle enseña el pasado sin dejar tocarlo. La regla
vive en `get_habit_stats` (migración 0012, la aritmética de islas sobre
`dias_que_tocan_hasta`); no la reimplementes en TypeScript. Entre 0010 y 0012
existió una "racha en pausa" con huecos que se contestaban después; se quitó
porque con ella daba igual abrir la app.

Y dos costumbres más chicas: la bitácora de hoy se abre cuando todo lo que
tocaba hoy tiene registro (lo comprueba `saveJournal`, además de la pantalla),
y cada hábito nuevo recibe un color que ningún otro activo esté usando
(`colorLibre` en `src/app/actions/habits.ts`).

## Cómo se trabaja aquí

Antes de cada push: `npm run typecheck && npm run lint && npm run build`.

El esquema tiene pruebas de verdad en `supabase/tests/` — corren contra un
Postgres real y cubren rachas, aislamiento entre cuentas, recordatorios y
borrado en cascada; `supabase/tests/README.md` dice cómo. Si tocas
`supabase/migrations/`, córrelas y regenera `setup-completo.sql`:

```bash
cat supabase/migrations/*.sql supabase/seed.sql > supabase/setup-completo.sql
```

Los colores y tipografías salen de los tokens de `src/app/globals.css` y están
como se quieren: no se cambian. La paleta es propia (`--c-azul`, `--c-naranja`,
`--c-menta`, `--c-ambar`, `--c-lila`, y el único rojo, `--c-rojo`), cada acento
trae su tinta (`--c-*-tinta`) y todo sube de luminosidad en oscuro. Las fuentes
son Fredoka para títulos y números y Figtree para el resto, cargadas con
`next/font` en `src/app/layout.tsx`: se sirven desde nuestro dominio, sin
petición a Google en tiempo de carga. En los componentes se usan las clases de
Tailwind que exponen esos tokens (`bg-ambar`, `text-ambar-tinta`,
`font-display`), nunca hex sueltos; el único sitio donde hay hex son los
muñecos de `companion.tsx` y `HABIT_HEX`, que alimentan SVG y confetti.

Las hojas modales (`role="dialog"`) pasan por `useHojaModal` de
`src/components/portal.tsx`, que pone el foco dentro, cierra con Escape y
encierra el Tab. Una hoja nueva lo usa; no se reimplementa.

Las acciones de servidor validan lo que reciben antes de tocar Postgres
(`esZonaValida`, `esFechaISO`, las listas cerradas de `src/lib/types.ts`): una
acción la puede llamar cualquiera con sesión mandando lo que quiera, y el error
crudo del esquema no es un mensaje para nadie. Y devuelven `{ error }`, que el
componente enseña: ningún resultado de acción se tira sin mirarlo.
