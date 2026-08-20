# Antídoto — Plan de construcción

## Contexto

El repositorio `21reto` está vacío (sin commits): es un proyecto greenfield. El objetivo es
construir **Antídoto**, una app de trackeo de hábitos enfocada en *detox* de malos hábitos y
adicciones, donde el usuario registra uno o varios hábitos, marca su cumplimiento diario, lleva
una bitácora con reacción emocional del día y recibe una frase motivacional diaria. El registro
de usuario existe para que nadie pierda su progreso al cambiar de dispositivo.

Decisiones ya tomadas con el usuario:

- **Plataforma:** Web app instalable (PWA), no app nativa.
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions).
- **Modelo:** retos con meta de días — 21 por defecto, configurable a 30/60/90 o personalizado.
- **Alcance:** la app lo más completa posible, no un MVP recortado. Entran núcleo, bitácora con
  reacción del día, frases diarias y recordatorios.

Resultado buscado: una app visual, rápida, que se abre a diario desde el celular, funciona
offline para consultar y sincroniza al recuperar conexión.

---

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | SSR para el shell, rutas API para push, despliegue directo en Vercel |
| Estilos | Tailwind CSS v4 + CSS variables de tema | La app es muy visual; tokens de color por hábito y modo oscuro/claro |
| Componentes | shadcn/ui (Radix) | Accesibles por defecto, se personalizan sin pelear con el diseño |
| Animación | Framer Motion | Anillos de progreso, transición del check diario, confetti de hito |
| Gráficas | Recharts | Barras semanales y línea de ánimo, sin dependencias pesadas |
| Datos | Supabase JS v2 + `@supabase/ssr` | Sesión en cookies, RLS aplicada en servidor y cliente |
| Estado servidor | TanStack Query | Cache, mutaciones optimistas para el check diario, reintento offline |
| Fechas | `date-fns` + `date-fns-tz` | El "día" depende de la zona horaria del usuario |
| PWA | `@ducanh2912/next-pwa` (Workbox) | Manifest, service worker, precache del shell |
| Push | Web Push (VAPID) + `web-push` en Edge Function | Recordatorios sin depender de servicios de terceros |
| Deploy | Vercel + proyecto Supabase | Preview por PR, cron nativo |

**Advertencia honesta sobre push en iOS:** Safari solo entrega Web Push si el usuario **instala**
la PWA en la pantalla de inicio (iOS 16.4+). El plan incluye un banner de instalación explícito y
un recordatorio de respaldo por email para quien no instale.

---

## Modelo de datos (Postgres, todo con RLS por `auth.uid()`)

```
profiles          id(=auth.users) · display_name · avatar_url · timezone · theme
                  · reminder_enabled · reminder_time · onboarded_at

habits            id · user_id · name · description · kind('quit'|'build')
                  · icon · color · target_days(default 21) · start_date
                  · status('active'|'completed'|'archived')
                  · relapse_policy('reset'|'continue') · reminder_time · created_at

habit_logs        id · habit_id · user_id · log_date(DATE)
                  · status('success'|'relapse'|'skipped') · note · created_at
                  UNIQUE(habit_id, log_date)          ← un registro por hábito por día

journal_entries   id · user_id · entry_date(DATE) · mood(TEXT) · intensity(1..5)
                  · note · created_at
                  UNIQUE(user_id, entry_date)          ← una entrada por día

quotes            id · text · author · tag · active     ← catálogo público, lectura anónima
push_subscriptions id · user_id · endpoint · p256dh · auth · user_agent
```

Puntos clave del esquema:

- `log_date` es `DATE`, **calculada en el cliente con la zona horaria del perfil**, nunca con
  `now()` del servidor. Sin esto, quien marca a las 11 p.m. en México ve el check caer en el día
  siguiente.
- Rachas: función SQL `get_habit_stats(habit_id)` con window functions que devuelve racha actual,
  mejor racha, días limpios totales y % de cumplimiento. Evita traer todo el histórico al cliente.
- Vista `daily_overview` que junta hábitos activos + log de hoy + entrada de bitácora, para que el
  home haga **una sola consulta**.
- Migraciones versionadas en `supabase/migrations/`, más un `seed.sql` con ~120 frases en español.

---

## Pantallas

1. **Landing + Auth** (`/`, `/login`) — propuesta de valor, registro con email (magic link),
   Google y Apple. Redirige a onboarding si `onboarded_at` es null.
2. **Onboarding** (`/bienvenida`) — wizard de 3 pasos: qué quieres dejar (chips sugeridos: alcohol,
   nicotina, azúcar, redes sociales, porno, apuestas, cafeína, compras + libre) → cuántos días
   (21/30/60/90/custom) → hora de recordatorio y permiso de notificaciones.
3. **Hoy** (`/hoy`) — pantalla principal. Frase del día arriba, tarjeta por hábito con anillo de
   progreso (día X de 21), botón grande de check y acción secundaria de recaída, selector de
   reacción del día con emojis, acceso rápido a escribir en la bitácora.
4. **Detalle de hábito** (`/habito/[id]`) — heatmap calendario tipo GitHub con el color del hábito,
   racha actual y mejor racha, hitos (día 1, 3, 7, 14, 21, 30…), historial de notas y recaídas,
   editar/archivar.
5. **Bitácora** (`/bitacora`) — timeline por fecha con emoji de ánimo, nota y qué hábitos se
   cumplieron ese día. Filtro por mes y por estado de ánimo.
6. **Progreso** (`/progreso`) — barras de cumplimiento semanal, línea de ánimo en el tiempo,
   correlación simple ánimo↔cumplimiento, total de días limpios acumulados entre todos los hábitos.
7. **Ajustes** (`/ajustes`) — perfil, zona horaria, tema claro/oscuro, recordatorios, instalar app,
   exportar datos a JSON/CSV, cerrar sesión, **eliminar cuenta** (borrado en cascada).

Transversal: navegación inferior fija estilo app (Hoy · Bitácora · Progreso · Ajustes), toasts de
confirmación, animación de confetti al completar un hito.

---

## Fases de implementación

**Fase 0 — Fundaciones**
Scaffold Next.js + TypeScript + Tailwind + shadcn. ESLint/Prettier. `.env.example`. Proyecto
Supabase y cliente SSR (`lib/supabase/{client,server,middleware}.ts`). Layout base con navegación.

**Fase 1 — Base de datos**
Migraciones con las 6 tablas, políticas RLS por usuario en cada una, trigger que crea `profiles` al
registrarse, función `get_habit_stats`, vista `daily_overview`, `seed.sql` de frases. Tipos
generados con `supabase gen types typescript`.

**Fase 2 — Auth y perfil**
Login/registro, callback OAuth, middleware que protege rutas, detección de zona horaria en el
primer login, onboarding con creación del primer hábito.

**Fase 3 — Hábitos y check diario**
CRUD de hábitos con selector de icono y color. Check diario con mutación optimista (se pinta al
instante, se revierte si falla). Registro de recaída con confirmación suave y nota opcional.
Cálculo y despliegue de racha/progreso hacia la meta de días. Cierre automático del reto al llegar
a `target_days` con opción de extender.

**Fase 4 — Capa visual**
Anillo de progreso animado en SVG, heatmap calendario, hitos con confetti, paleta por hábito, modo
oscuro, estados vacíos ilustrados, skeletons de carga.

**Fase 5 — Bitácora y reacción del día**
Selector de emoji (12–16 estados: 😄 🙂 😐 😔 😣 😤 😰 🥱 🤒 🥳 😌 🫥 …) con intensidad 1–5, editor
de nota, timeline con filtros, edición de días pasados.

**Fase 6 — Frases diarias**
Selección determinista por `(user_id, fecha)` para que no cambie al recargar y sea distinta por
usuario. Fallback a un JSON local empaquetado si Supabase no responde. Botón de compartir como
imagen.

**Fase 7 — Recordatorios**
Registro de suscripción push en el service worker, guardado en `push_subscriptions`, Edge Function
`send-reminders` invocada cada hora por cron que despacha a quienes tengan `reminder_time` en esa
franja según su zona horaria. Limpieza de suscripciones caducadas (410/404). Banner de instalación
para iOS. Respaldo por email vía Supabase.

**Fase 8 — PWA, offline y pulido**
Manifest, iconos, splash, `display: standalone`. Precache del shell; cola de mutaciones pendientes
que se reintenta al recuperar red. Accesibilidad (foco visible, contraste AA, `aria-live` en el
check). Exportar/eliminar cuenta. Metadatos y OG.

**Fase 9 — Despliegue**
Vercel + Supabase de producción, variables de entorno, cron, README con instrucciones de setup.

---

## Nota de responsabilidad

La app toca adicciones reales. Incluir en Ajustes y en el flujo de recaída un texto breve —
*Antídoto acompaña tu proceso, no sustituye atención profesional* — con enlace a líneas de ayuda.
Y en el registro de recaída, lenguaje sin castigo: la recaída se muestra como dato, no como fracaso.

---

## Verificación

**Local**
```bash
npm run dev                      # app en localhost:3000
npx supabase start               # Postgres + Auth locales
npx supabase db reset            # aplica migraciones + seed
npm run lint && npm run build    # debe pasar limpio antes de cada push
```

**Recorrido manual completo (ruta crítica)**
1. Registrarse con email → llega magic link → entra al onboarding.
2. Crear hábito "Sin alcohol", meta 21 días, recordatorio 21:00 → aparece en Hoy.
3. Marcar el día → anillo avanza a 1/21, racha en 1. Recargar: persiste.
4. Guardar reacción 🙂 + nota → aparece en Bitácora con la fecha correcta.
5. Registrar una recaída → según política, la racha se reinicia o continúa; el heatmap la marca.
6. Insertar logs de días pasados desde SQL → verificar racha, mejor racha y % en Progreso.
7. Cambiar la zona horaria del perfil → confirmar que el check sigue cayendo en el día local.
8. Instalar la PWA en Android e iOS → aceptar notificaciones → forzar la Edge Function y confirmar
   que llega el recordatorio.
9. Modo avión: la app abre con datos cacheados; el check se encola y sincroniza al volver la red.
10. Exportar datos y eliminar cuenta → confirmar borrado en cascada en todas las tablas.

**Seguridad**
Con dos cuentas distintas, consultar `habits`, `habit_logs` y `journal_entries` de la otra:
las políticas RLS deben devolver cero filas.

---

## Entregable

Todo el desarrollo va en la rama `claude/antidoto-app-plan-cj964q`, con commits por fase y un pull
request en borrador al terminar.
