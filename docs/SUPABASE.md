# Conectar Supabase — paso a paso

Al terminar esto la app corre en `localhost:3000` con login real y datos que
persisten. Toma unos 15 minutos, casi todos de espera.

## 1. Crear el proyecto

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta (el plan
   gratuito alcanza de sobra para esto).
2. **New project**. Te pide tres cosas:
   - **Name**: `antidoto`
   - **Database password**: genera una larga y **guárdala en tu gestor de
     contraseñas ahora mismo**. Supabase no te la vuelve a mostrar, y sin ella
     no puedes conectarte por CLI ni por psql.
   - **Region**: la más cercana a tus usuarios. Para Latinoamérica,
     `South America (São Paulo)` o `East US (North Virginia)`.
3. Dale a **Create new project** y espera unos dos minutos a que aprovisione.

## 2. Copiar las dos credenciales

Están en dos páginas distintas del panel.

**La llave** — **Project Settings → API Keys**, sección **Publishable key**. Es
una cadena que empieza con `sb_publishable_…`; cópiala con el botón de la
derecha.

Supabase renombró sus llaves: la *publishable key* es lo que antes se llamaba
*anon key*, y las *secret keys* son lo que antes era la *service_role*. Si tu
proyecto es viejo puedes ver todavía los nombres antiguos y una llave que
empieza con `eyJ…`; sirve igual.

La publishable key es pública por diseño: viaja al navegador en cada carga, y lo
que protege los datos son las políticas RLS del esquema. Las **secret keys** que
aparecen más abajo en esa misma página son otra cosa — se saltan todas las
políticas, así que no van en este proyecto ni en ningún archivo del repo.

**La URL** — menú lateral, bajo INTEGRATIONS, **Data API**. Ahí sale el
*Project URL*, con la forma `https://abcdefghijk.supabase.co`. También puedes
armarla: el `abcdefghijk` es el identificador del proyecto que aparece en la
barra de direcciones del navegador.

## 3. Ponerlas en el proyecto

En la raíz del repo:

```bash
cp .env.example .env.local
```

Abre `.env.local` y pega los dos valores:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

La variable se sigue llamando `ANON_KEY` por costumbre; el cliente de Supabase
acepta los dos formatos de llave sin cambiar nada.

`.env.local` está en `.gitignore`, así que no se sube al repo.

## 4. Crear las tablas

Dos caminos. El primero es más rápido de hacer una vez; el segundo es el que
conviene si vas a seguir cambiando el esquema.

### Camino A — pegar el SQL en el panel

1. En el panel, **SQL Editor → New query**.
2. Abre `supabase/setup-completo.sql`, copia todo y pégalo. **Run**. Ese archivo
   junta las dos migraciones y las frases, así que es una sola pasada.
3. Comprueba en **Table Editor** que aparezcan las cinco tablas: `profiles`,
   `habits`, `habit_logs`, `journal_entries` y `quotes`.

`setup-completo.sql` se genera desde los otros archivos; si tocas el esquema,
regenéralo en vez de editarlo a mano:

```bash
cat supabase/migrations/*.sql supabase/seed.sql > supabase/setup-completo.sql
```

### Camino B — con el CLI

```bash
npx supabase login                      # abre el navegador
npx supabase link --project-ref abcdefghijk   # el ref sale de tu Project URL
npx supabase db push                    # aplica supabase/migrations/
```

Te va a pedir la contraseña de base de datos del paso 1.

## 5. Configurar el acceso por correo

Antídoto entra por *magic link*: sin contraseñas.

1. **Authentication → Providers → Email**: que esté activado. Puedes apagar
   *Confirm email* mientras pruebas, para que el primer enlace entre directo.
2. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: agrega `http://localhost:3000/auth/callback`

Sin ese redirect el enlace del correo llega pero rebota.

## 6. Probar

```bash
npm run dev
```

Abre `http://localhost:3000`, dale a **Empezar**, escribe tu correo y revisa la
bandeja. El enlace te lleva al onboarding; eliges qué dejar y cuántos días, y
caes en la pantalla Hoy.

## Cuando algo no funciona

**No llega el correo.** El servidor de correo que Supabase da gratis tiene un
límite bajo — unos pocos envíos por hora — y a veces cae en spam. Revisa
**Authentication → Logs** para ver si salió. Para producción hay que conectar un
SMTP propio (Resend, Postmark) en **Project Settings → Auth → SMTP Settings**.

**El enlace abre y me devuelve al login.** Falta el redirect del paso 5, o lo
abriste en un navegador distinto al que pidió el enlace.

**Entro pero no veo nada y la consola marca error de permisos.** El SQL del paso
4 no corrió completo. Vuelve a pegarlo: el archivo es idempotente en su mayor
parte, pero si quedó a medias es más limpio borrar las tablas y correrlo de
nuevo.

**Marco un día y aparece en la fecha equivocada.** Revisa el campo `timezone` de
tu fila en `profiles`. Debería tener algo como `America/Bogota`; si dice `UTC`,
el login no alcanzó a guardarlo — puedes corregirlo a mano en el Table Editor.

## Antes de publicar

- Repite el paso 5 con el dominio real en Site URL y Redirect URLs.
- Conecta un SMTP propio.
- Vuelve a activar *Confirm email*.
- Corre las pruebas del esquema contra el proyecto real:
  `supabase/tests/README.md` explica cómo.
