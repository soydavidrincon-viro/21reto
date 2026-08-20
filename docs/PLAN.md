# Antídoto — Plan de construcción

## Contexto

El repositorio `21reto` está vacío: proyecto desde cero. **Antídoto** es una app de trackeo de
hábitos enfocada en *detox* de malos hábitos y adicciones. El usuario registra uno o varios
hábitos, marca su cumplimiento diario, lleva una bitácora con reacción emocional del día y recibe
una frase motivacional diaria. El registro de usuario existe para que nadie pierda su progreso al
cambiar de dispositivo.

Decisiones tomadas con el usuario:

- **Plataforma:** web app instalable (PWA), no nativa.
- **Backend:** Supabase (Postgres + Auth + Storage).
- **Modelo:** retos con meta de días — 21 por defecto, configurable a 30/60/90 o personalizado.
- **Alcance:** app completa, no un MVP recortado.
- **Fuera por ahora:** recordatorios y notificaciones push (ver *Fuera de alcance* al final).

---

## Dirección visual

La referencia azul/naranja (pantallas *Daily Challenge* y *Profile*) define el branding. Las otras
cuatro referencias aportan patrones concretos, no la identidad.

**Paleta**

| Token | Hex | Uso |
|---|---|---|
| `--azul` | `#1B4DFF` | Primario: acciones, día cumplido, tarjeta del reto |
| `--naranja` | `#FF6B2C` | Racha, hitos, energía |
| `--menta` | `#12C7A6` | Progreso completado, segundo color de tarjeta |
| `--ambar` | `#F2B441` | Recaída — nunca rojo, la recaída es dato, no castigo |
| `--tinta` | `#14161C` | Texto, botones sólidos, nav flotante |
| `--nieve` | `#F6F8FC` | Fondo de app: gris con sesgo frío hacia el azul |

Modo oscuro con los mismos tokens redefinidos: `--tinta` pasa a fondo, azul y naranja suben
luminosidad para mantener contraste AA sobre oscuro.

**Tipografía:** `Sora` para display y números grandes (racha, día X de 21), `Plus Jakarta Sans`
para UI y texto corrido. `font-variant-numeric: tabular-nums` en todo contador que cambie a diario.

**Patrones tomados de cada referencia**

- *Azul/naranja* — tarjeta grande destacada arriba del home (el reto activo), tira horizontal de
  fechas con píldora del día seleccionado, tarjetas de hábito en colores sólidos alternados, nav
  inferior flotante oscura de esquinas muy redondeadas.
- *Streak naranja* — anillo de progreso con número grande al centro, fila de la semana con checks
  (L M M J V S D), grid de estadísticas de 4 columnas.
- *Onboarding cream* — chips de selección múltiple para elegir qué hábito dejar.
- *Fitness lima* — botones pill de ancho completo, jerarquía de tarjeta blanca sobre fondo claro.

**Nota de ejecución:** las referencias usan renders 3D. Esos son assets de diseñador que no
tenemos; uso iconografía plana con relleno sólido y sombras suaves, que sostiene el mismo aire sin
depender de arte externo. Si consigues los renders, se sustituyen sin tocar el layout.

---

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | SSR para el shell, despliegue directo en Vercel |
| Estilos | Tailwind CSS v4 + CSS variables | Tokens de la paleta arriba, tema claro/oscuro |
| Componentes | shadcn/ui (Radix) | Accesibles por defecto, se repintan con nuestros tokens |
| Animación | Framer Motion | Anillo de progreso, transición del check, confetti de hito |
| Gráficas | Recharts | Barras semanales y línea de ánimo |
| Datos | Supabase JS v2 + `@supabase/ssr` | Sesión en cookies, RLS en servidor y cliente |
| Estado servidor | TanStack Query | Cache y mutación optimista del check diario |
| Fechas | `date-fns` + `date-fns-tz` | El "día" depende de la zona horaria del usuario |
| PWA | `@ducanh2912/next-pwa` (Workbox) | Manifest, service worker, precache del shell |
| Deploy | Vercel + Supabase | Preview por PR |

---

## Modelo de datos (Postgres, RLS por `auth.uid()` en todas las tablas)

```
profiles          id(=auth.users) · display_name · avatar_url · timezone · theme · onboarded_at

habits            id · user_id · name · description · kind('quit'|'build')
                  · icon · color · target_days(default 21) · start_date
                  · status('active'|'completed'|'archived')
                  · relapse_policy('reset'|'continue') · created_at

habit_logs        id · habit_id · user_id · log_date(DATE)
                  · status('success'|'relapse'|'skipped') · note · created_at
                  UNIQUE(habit_id, log_date)          ← un registro por hábito por día

journal_entries   id · user_id · entry_date(DATE) · mood(TEXT) · intensity(1..5)
                  · note · created_at
                  UNIQUE(user_id, entry_date)          ← una entrada por día

quotes            id · text · author · tag · active     ← catálogo público, lectura anónima
```

Puntos clave:

- `log_date` es `DATE` **calculada en el cliente con la zona horaria del perfil**, nunca con
  `now()` del servidor. Sin esto, quien marca a las 11 p.m. en México ve el check caer al día
  siguiente.
- Función SQL `get_habit_stats(habit_id)` con window functions: racha actual, mejor racha, días
  limpios totales y % de cumplimiento. Evita traer el histórico completo al cliente.
- Vista `daily_overview` que junta hábitos activos + log de hoy + entrada de bitácora, para que el
  home haga **una sola consulta**.
- Migraciones versionadas en `supabase/migrations/`, más `seed.sql` con ~120 frases en español.

---

## Pantallas

1. **Landing + Auth** (`/`, `/login`) — propuesta de valor, registro con email (magic link),
   Google y Apple. Redirige a onboarding si `onboarded_at` es null.
2. **Onboarding** (`/bienvenida`) — dos pasos: chips para elegir qué dejar (alcohol, nicotina,
   azúcar, redes sociales, porno, apuestas, cafeína, compras + libre) → meta de días
   (21/30/60/90/custom).
3. **Hoy** (`/hoy`) — pantalla principal. Frase del día, tira de fechas, tarjeta grande del reto
   activo con anillo de progreso (día X de 21), tarjetas de hábito en colores alternados con botón
   de check, acción secundaria de recaída, selector de reacción del día.
4. **Detalle de hábito** (`/habito/[id]`) — heatmap calendario en el color del hábito, racha actual
   y mejor racha, hitos (día 1, 3, 7, 14, 21, 30…), historial de notas y recaídas, editar/archivar.
5. **Bitácora** (`/bitacora`) — timeline por fecha con emoji de ánimo, nota y hábitos cumplidos ese
   día. Filtro por mes y por estado de ánimo.
6. **Progreso** (`/progreso`) — barras de cumplimiento semanal, línea de ánimo en el tiempo, total
   de días limpios acumulados, grid de estadísticas de 4 columnas.
7. **Ajustes** (`/ajustes`) — perfil, zona horaria, tema, instalar app, exportar a JSON/CSV,
   cerrar sesión, **eliminar cuenta** (borrado en cascada).

Transversal: nav inferior flotante oscura (Hoy · Bitácora · Progreso · Perfil), toasts de
confirmación, confetti al completar un hito.

---

## Fases de implementación

**Fase 0 — Fundaciones.** Scaffold Next.js + TypeScript + Tailwind + shadcn. Tokens de la paleta y
las dos tipografías. ESLint/Prettier. `.env.example`. Proyecto Supabase y cliente SSR
(`lib/supabase/{client,server,middleware}.ts`). Layout con la nav flotante.

**Fase 1 — Base de datos.** Migraciones de las 5 tablas, políticas RLS, trigger que crea `profiles`
al registrarse, `get_habit_stats`, vista `daily_overview`, `seed.sql` de frases. Tipos generados
con `supabase gen types typescript`.

**Fase 2 — Auth y perfil.** Login/registro, callback OAuth, middleware que protege rutas, detección
de zona horaria en el primer login, onboarding de dos pasos con creación del primer hábito.

**Fase 3 — Hábitos y check diario.** CRUD con selector de icono y color. Check con mutación
optimista (se pinta al instante, se revierte si falla). Registro de recaída con confirmación suave
y nota opcional. Racha y progreso hacia la meta. Cierre del reto al llegar a `target_days` con
opción de extender.

**Fase 4 — Capa visual.** Anillo de progreso animado en SVG, heatmap calendario, tira de fechas,
tarjetas de color, hitos con confetti, modo oscuro, estados vacíos ilustrados, skeletons.

**Fase 5 — Bitácora y reacción del día.** Selector de emoji (12–16 estados) con intensidad 1–5,
editor de nota, timeline con filtros, edición de días pasados.

**Fase 6 — Frases diarias.** Selección determinista por `(user_id, fecha)` para que no cambie al
recargar y sea distinta por usuario. Fallback a JSON local empaquetado. Compartir como imagen.

**Fase 7 — PWA, offline y pulido.** Manifest, iconos, splash, `display: standalone`. Precache del
shell; cola de mutaciones pendientes que se reintenta al recuperar red. Accesibilidad (foco
visible, contraste AA, `aria-live` en el check). Exportar y eliminar cuenta. Metadatos y OG.

**Fase 8 — Despliegue.** Vercel + Supabase de producción, variables de entorno, README de setup.

---

## Fuera de alcance por ahora

**Recordatorios y notificaciones push.** Quitados a pedido del usuario. Cuando entren, requieren:
tabla `push_subscriptions`, campos `reminder_time` en `profiles` y `habits`, claves VAPID, Edge
Function `send-reminders` invocada por cron cada hora que despache según zona horaria, y limpieza
de suscripciones caducadas. Sumar entonces la advertencia de iOS: Safari solo entrega Web Push si
el usuario **instala** la PWA en la pantalla de inicio (iOS 16.4+).

---

## Nota de responsabilidad

La app toca adicciones reales. En Ajustes y en el flujo de recaída va un texto breve — *Antídoto
acompaña tu proceso, no sustituye atención profesional* — con enlace a líneas de ayuda. La recaída
se registra en ámbar, no en rojo, y se muestra como dato, no como fracaso.

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
2. Crear hábito "Sin alcohol", meta 21 días → aparece en Hoy.
3. Marcar el día → anillo avanza a 1/21, racha en 1. Recargar: persiste.
4. Guardar reacción 🙂 + nota → aparece en Bitácora con la fecha correcta.
5. Registrar una recaída → según política, la racha se reinicia o continúa; el heatmap la marca en
   ámbar.
6. Insertar logs de días pasados desde SQL → verificar racha, mejor racha y % en Progreso.
7. Cambiar la zona horaria del perfil → confirmar que el check sigue cayendo en el día local.
8. Instalar la PWA en Android e iOS → abre en modo standalone sin barra del navegador.
9. Modo avión: la app abre con datos cacheados; el check se encola y sincroniza al volver la red.
10. Exportar datos y eliminar cuenta → confirmar borrado en cascada en todas las tablas.
11. Alternar tema claro/oscuro y sistema → ningún texto queda ilegible, contraste AA en ambos.

**Seguridad.** Con dos cuentas distintas, consultar `habits`, `habit_logs` y `journal_entries` de
la otra: las políticas RLS deben devolver cero filas.

---

## Entregable

Todo el desarrollo va en la rama `claude/antidoto-app-plan-cj964q`, con commits por fase y un pull
request en borrador.
