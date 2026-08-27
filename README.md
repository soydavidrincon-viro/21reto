# Antídoto

App de trackeo de hábitos para dejar lo que te pesa, un día a la vez. Retos de
21 días (o los que elijas), bitácora con reacción diaria y frase del día.

Web app instalable (PWA) en lenguaje visual de iOS. El plan completo está en
[`docs/PLAN.md`](docs/PLAN.md); los mockups de las pantallas, en `design/`.

Para verlo funcionando: [`docs/DEPLOY.md`](docs/DEPLOY.md) — publicarlo en
Vercel o correrlo en tu máquina. Para conectar la base de datos:
[`docs/SUPABASE.md`](docs/SUPABASE.md).

## Poner a andar el proyecto

```bash
npm install
cp .env.example .env.local     # y llena las dos variables de Supabase
npm run dev                    # http://localhost:3000
```

Para la base de datos hace falta el [CLI de Supabase](https://supabase.com/docs/guides/cli):

```bash
npx supabase start             # Postgres + Auth locales
npx supabase db reset          # aplica migrations/ y seed.sql
npm run db:types               # regenera los tipos TypeScript del esquema
```

Antes de cada push:

```bash
npm run typecheck && npm run lint && npm run build
```

## Cómo está organizado

```
src/app/(app)/       Pantallas con sesión, bajo el shell con tab bar
src/app/login/       Entrada por magic link
src/app/bienvenida/  Onboarding: primer hábito y duración del reto
src/components/      UI compartida (anillos, filas de hábito, formulario)
src/lib/dates.ts     Todo lo que depende de "qué día es hoy" para el usuario
src/lib/supabase/    Clientes de navegador, servidor y proxy de sesión
supabase/migrations/ Esquema, RLS y funciones SQL
```

## Dos decisiones que conviene no romper

**El día lo decide el usuario, no el servidor.** Cada fecha sale de
`todayIn(profile.timezone)`. Si alguna consulta usara `now()` o `current_date`
de Postgres, quien marca a las 23:40 en Ciudad de México vería su check caer en
el día siguiente y perdería la racha sin haber hecho nada mal.

**La recaída no se castiga.** Se guarda en amarillo, nunca en rojo, y no borra
los días acumulados. La app acompaña un proceso; no sustituye atención
profesional, y eso aparece escrito donde el usuario lo va a leer.

## Estado

Listo: fundaciones, esquema con RLS, entrada por magic link, onboarding,
Hoy con anillos y check diario, detalle de hábito con heatmap, bitácora con
editor y timeline, progreso con cumplimiento semanal y línea de ánimo, y perfil
con tema, zona horaria, exportación y borrado de cuenta.

Falta: service worker y modo offline, hitos con confetti, y cerrar el reto al
llegar a la meta de días.
