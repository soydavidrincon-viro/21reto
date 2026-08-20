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

La app debe sentirse nativa de iPhone. Las referencias azul/naranja fijaron el branding; el
lenguaje visual es el de iOS, que usa casi los mismos tonos en sus colores de sistema.

**Paleta — colores de sistema de iOS**

| Token | Hex | Uso |
|---|---|---|
| `--blue` | `#007AFF` | Primario: botones, día cumplido, anillo del reto |
| `--orange` | `#FF9500` | Racha e hitos |
| `--green` | `#34C759` | Cumplido, tendencia positiva |
| `--yellow` | `#FFCC00` | Recaída — nunca rojo, la recaída es dato, no castigo |
| `--label` | `#000000` | Texto principal |
| `--label-2` | `rgba(60,60,67,0.6)` | Texto secundario |
| `--separator` | `rgba(60,60,67,0.29)` | Separadores de lista, hairlines de 0.5px |
| `--grouped-bg` | `#F2F2F7` | Fondo agrupado de la app |

Modo oscuro con los equivalentes oscuros de iOS: fondo `#000000`, tarjetas `#1C1C1E`, y las
variantes dark de los colores de sistema (`#0A84FF`, `#FF9F0A`, `#30D158`, `#FFD60A`).

**Tipografía — sin fuentes de catálogo.** SF Pro no puede servirse como webfont; la licencia solo
cubre plataformas Apple. La vía correcta es el *system font stack*, que en iPhone y Mac resuelve a
SF Pro real:

```css
--font-ui: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto,
           'Helvetica Neue', system-ui, sans-serif;
--font-num: ui-rounded, 'SF Pro Rounded', -apple-system, 'Segoe UI Variable Display',
            Roboto, system-ui, sans-serif;
```

`--font-num` va en rachas, contadores y porcentajes; en iOS resuelve a SF Pro Rounded, la de los
anillos de Fitness. Siempre con `font-variant-numeric: tabular-nums`.

**Patrones de iOS a respetar**

- Título grande (34px bold, tracking −0.026em) al tope de cada sección raíz.
- Listas agrupadas insertadas: tarjeta blanca de radio 16, filas de 44px mínimo, separador de
  0.5px que arranca a 58px del borde cuando la fila tiene icono.
- Control segmentado para duración del reto y para el rango en Progreso.
- Anillos concéntricos tipo Fitness en Hoy, uno por hábito activo.
- Tab bar translúcida de 83px con `backdrop-filter: blur(20px)`, icono de 26px y etiqueta de 10px.
- Emoji del sistema como iconografía de hábitos y en el selector de ánimo.

**Qué se ve distinto fuera de Apple.** En Android el layout, los colores y los anillos son
idénticos; cambian la tipografía (cae a Roboto) y los emoji (los de Google). Los glifos de Apple
son propietarios y no se pueden empaquetar. Los iconos de la tab bar imitan el estilo de SF
Symbols porque los originales tampoco son redistribuibles.

**Sin chrome falso.** No dibujar barra de estado ni home indicator: en el teléfono real los pinta
el sistema encima y se verían duplicados.

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

**Fase 0 — Fundaciones.** Scaffold Next.js + TypeScript + Tailwind + shadcn. Tokens de color y los
dos stacks tipográficos. ESLint/Prettier. `.env.example`. Proyecto Supabase y cliente SSR
(`lib/supabase/{client,server,middleware}.ts`). Layout con la tab bar translúcida.

**Fase 1 — Base de datos.** Migraciones de las 5 tablas, políticas RLS, trigger que crea `profiles`
al registrarse, `get_habit_stats`, vista `daily_overview`, `seed.sql` de frases. Tipos generados
con `supabase gen types typescript`.

**Fase 2 — Auth y perfil.** Login/registro, callback OAuth, middleware que protege rutas, detección
de zona horaria en el primer login, onboarding de dos pasos con creación del primer hábito.

**Fase 3 — Hábitos y check diario.** CRUD con selector de icono y color. Check con mutación
optimista (se pinta al instante, se revierte si falla). Registro de recaída con confirmación suave
y nota opcional. Racha y progreso hacia la meta. Cierre del reto al llegar a `target_days` con
opción de extender.

**Fase 4 — Capa visual.** Anillos concéntricos animados en SVG, heatmap calendario, listas
agrupadas, control segmentado, tab bar translúcida, hitos con confetti, modo oscuro, estados
vacíos, skeletons.

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
se registra en amarillo, no en rojo, y se muestra como dato, no como fracaso.

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
   amarillo.
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
