# Antídoto

App de trackeo de hábitos para dejar lo que te pesa, un día a la vez. Retos de
21 días (o los que elijas), bitácora con reacción diaria y frase del día.

Web app instalable (PWA) en lenguaje visual de iOS. El plan completo está en
[`docs/PLAN.md`](docs/PLAN.md); los mockups de las pantallas, en `design/`.

Para verlo funcionando: [`docs/DEPLOY.md`](docs/DEPLOY.md) — publicarlo en
Vercel o correrlo en tu máquina. Para conectar la base de datos:
[`docs/SUPABASE.md`](docs/SUPABASE.md). Cómo funcionan las cuentas y qué falta
antes de abrirla a gente real: [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md). Para
activar el ingreso con Google: [`docs/GOOGLE-LOGIN.md`](docs/GOOGLE-LOGIN.md).

## Poner a andar el proyecto

```bash
npm install
cp .env.example .env.local     # las dos de Supabase bastan para correrla;
                               # las de recordatorios están explicadas dentro
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
profesional, y eso está escrito al pie de Perfil — una vez, y no en cada
pantalla.

## Estado

Listo: esquema con RLS y pruebas, entrada por Google o enlace al correo,
onboarding con compañero, Hoy con carrusel de retos y check diario, botón de
emergencia con registro de impulsos, detalle de hábito con calendario
navegable y tarjeta compartible, bitácora escribible por día, progreso con
cumplimiento semanal, rejilla de impulsos y línea de ánimo, hitos con
confetti, cierre del reto al llegar a la meta, recordatorios push con la hora
de cada quien, y perfil con foto, tema, zona horaria, exportación y borrado de
cuenta.

Falta: modo offline con cola de cambios (el service worker solo recibe avisos,
a propósito: ver `public/sw.js`), selector de icono y color para hábitos con
nombre propio, y entrada con Apple.
