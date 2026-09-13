# Recordatorios

Cómo están montados y qué hay que hacer para encenderlos.

## Por qué no es un cron de Vercel

El plan gratis de Vercel solo permite **un cron al día**, y con uno al día no se
puede respetar la hora de cada persona: alguien en Bogotá y alguien en Madrid
quieren su aviso a las 21:00 suyas, que son dos momentos distintos.

Así que el reloj vive en Supabase (`pg_cron`, gratis, cada hora) y lo único que
hace es llamar a un endpoint de la app. La lógica sigue en el repo, en
TypeScript, y se despliega sola con el resto.

```
pg_cron (Supabase, cada hora)
   └── POST https://21reto.vercel.app/api/recordatorios
          └── avisos_pendientes()   ← decide a quién, en SQL
          └── notification_log      ← anota primero, y así no repite
          └── web-push              ← cifra y manda, por lotes
```

## Las cuatro reglas

- **Dos al día, a horas fijas.** A las 9 (`manana`: por dónde va el reto y
  su porqué) y a las 21 (`noche`: lo que falta por marcar antes de
  medianoche, o la bitácora si ya marcó todo; la víspera de la meta, "Mañana
  llegas"). La hora difícil va aparte (`impulso`) cuando hay patrón. Cada
  aviso lleva su franja y la llave primaria de `notification_log`,
  `(user_id, local_date, slot)`, deja pasar uno por franja y día. El
  enviador primero anota y solo manda a quien consiguió anotar: dos corridas
  solapadas del cron —un reintento, un `curl` a mano— no mandan dos veces.
- **Apagados de fábrica.** `reminder_hour` nace nulo y la función ni mira a
  quien lo tenga vacío. Desde 0013 es solo el interruptor: la hora no se
  elige.
- **La hora es la de cada quien.** `timezone(p.timezone, now())`, igual que el
  resto de la app.
- **Nada de "te echamos de menos".** Ese aviso le llega a alguien que
  probablemente está teniendo una mala semana. La app entera está construida
  sobre no castigar.

## Qué hay que configurar

### 1. Variables de entorno

Genera el par de claves una sola vez:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

En **Vercel** (Settings → Environment Variables), las cuatro:

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | del comando de arriba |
| `VAPID_PRIVATE_KEY` | del comando de arriba |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → Secret key |

Después de añadirlas hay que **volver a desplegar**: las variables se leen en el
build, no en caliente.

### 2. El reloj en Supabase

En el SQL Editor, una vez:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'antidoto-recordatorios',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://21reto.vercel.app/api/recordatorios',
    headers := '{"Authorization": "Bearer EL_MISMO_CRON_SECRET", "Content-Type": "application/json"}'::jsonb
  );
  $$
);
```

Para ver que está puesto: `select * from cron.job;`
Para quitarlo: `select cron.unschedule('antidoto-recordatorios');`

### Dos trampas que nos costaron media hora

**El secreto se queda de adorno.** En el SQL del cron hay que sustituir el
placeholder por el `CRON_SECRET` de verdad. Si se pega tal cual, el cron llama
cada hora mandando la palabra `TU_CRON_SECRET`, el endpoint responde 401 y no
llega ni un aviso — sin que salte un error en ningún sitio.

**Hay que volver a desplegar.** Las variables de entorno se leen al construir,
no en caliente. Añadirlas en Vercel y no redesplegar deja el endpoint
devolviendo `sin configurar` para siempre. En Deployments → la fila de arriba →
`⋯` → Redeploy.

### 3. Comprobar sin despertar a nadie

El endpoint tiene modo seco: dice a quién le mandaría y no manda nada.

```bash
curl -X POST "https://21reto.vercel.app/api/recordatorios?dry=1" \
     -H "Authorization: Bearer EL_CRON_SECRET"
```

Devuelve `{"seco": true, "total": N, "avisos": [...]}`.

## Lo que no se puede probar desde el repo

Que la notificación **llegue a un teléfono**. Se puede comprobar que la
suscripción se guarda, que la función elige bien a quién y que el envío no
falla — pero el último tramo pasa por los servidores de Google y Apple y solo se
ve en un dispositivo real.

## iPhone

Los avisos solo llegan si la app está en la pantalla de inicio; desde una
pestaña de Safari no llega nada, y Safari no ofrece el botón de instalar. La
hoja de recordatorios detecta ese caso y enseña los tres pasos.

No hay forma de saltárselo desde el código: es una decisión de Apple.
