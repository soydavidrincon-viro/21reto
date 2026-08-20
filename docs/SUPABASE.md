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

En el panel del proyecto, **Project Settings → API** (en algunos paneles la
sección se llama **API Keys**). Necesitas exactamente dos valores:

| Qué copiar | Cómo se ve |
|---|---|
| **Project URL** | `https://abcdefghijk.supabase.co` |
| **anon / public key** | una cadena larga que empieza con `eyJ…` |

En ese mismo lugar vas a ver una **service_role key**. Esa no la uses aquí y no
la pegues en ningún archivo del proyecto: se salta todas las políticas de
seguridad y quien la tenga puede leer y borrar los datos de cualquier usuario.
La `anon key` sí es pública por diseño — viaja al navegador en cada carga, y lo
que protege los datos son las políticas RLS del esquema.

## 3. Ponerlas en el proyecto

En la raíz del repo:

```bash
cp .env.example .env.local
```

Abre `.env.local` y pega los dos valores:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

`.env.local` está en `.gitignore`, así que no se sube al repo.

## 4. Crear las tablas

Dos caminos. El primero es más rápido de hacer una vez; el segundo es el que
conviene si vas a seguir cambiando el esquema.

### Camino A — pegar el SQL en el panel

1. En el panel, **SQL Editor → New query**.
2. Abre `supabase/migrations/0001_init.sql`, copia todo y pégalo. **Run**.
3. Nueva query con `supabase/migrations/0002_borrar_cuenta.sql`. **Run**.
4. Nueva query. Abre `supabase/seed.sql`, copia todo y pégalo. **Run** — esto
   carga las 60 frases del día.
5. Comprueba en **Table Editor** que aparezcan las cinco tablas: `profiles`,
   `habits`, `habit_logs`, `journal_entries` y `quotes`.

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
