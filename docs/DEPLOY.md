# Publicar y correr Antídoto

El código vive en GitHub: `soydavidrincon-viro/21reto`. La rama por defecto es
la que se despliega; el trabajo va en ramas `claude/...` que se funden por
pull request.

Hay dos formas de verlo funcionando. Si lo que quieres es **usarlo desde el
iPhone**, la primera es la única que sirve: iOS solo deja instalar una app web
en la pantalla de inicio si viene por HTTPS, y eso descarta `localhost`.

---

## Opción A — Vercel, sin descargar nada

1. Entra a [vercel.com](https://vercel.com) y crea cuenta **con GitHub**.
2. **Add New → Project**. Busca `21reto` e **Import**.
3. Vercel detecta Next.js solo. No cambies nada del build.
4. Antes de darle Deploy, abre **Environment Variables** y agrega las de
   Supabase. Con estas dos la app ya entra y guarda:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | la Project URL de tu proyecto |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu `sb_publishable_…` |

   Las cuatro de recordatorios (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) se pueden
   añadir después; están explicadas en `.env.example` y en
   [`RECORDATORIOS.md`](RECORDATORIOS.md). Sin ellas todo funciona menos los
   avisos.

5. **Deploy**. En un par de minutos te da una URL tipo
   `https://21reto.vercel.app`.
6. **Vuelve a Supabase** — este paso es el que se olvida y hace que el login
   parezca roto. En **Authentication → URL Configuration**:
   - **Site URL**: la URL de Vercel
   - **Redirect URLs**: agrega `https://tu-url.vercel.app/auth/callback`,
     y deja también las de `localhost` si vas a seguir desarrollando

Cada push a la rama por defecto vuelve a desplegar solo. Si añades o cambias
variables de entorno, hay que **redesplegar**: se leen al construir.

### Instalarla en el iPhone

Abre la URL en **Safari** (no Chrome — solo Safari puede instalar en iOS).
Botón de compartir → **Añadir a pantalla de inicio**. Se abre sin barra del
navegador, con su icono, como cualquier app. Los recordatorios en iPhone solo
llegan así, instalada.

---

## Opción B — en tu computador

Necesitas [Node.js 20 o más nuevo](https://nodejs.org) y Git.

```bash
git clone https://github.com/soydavidrincon-viro/21reto.git
cd 21reto
npm install
cp .env.example .env.local     # y pega dentro las dos variables de Supabase
npm run dev
```

Abre `http://localhost:3000`. Para que el magic link funcione, Supabase debe
tener `http://localhost:3000` como Site URL y
`http://localhost:3000/auth/callback` en Redirect URLs.

Antes de cada push: `npm run typecheck && npm run lint && npm run build`.

---

## Sobre dónde vive cada cosa

| Qué | Dónde |
|---|---|
| Código | GitHub |
| Base de datos, cuentas, sesiones y el reloj de los avisos | Supabase |
| La app servida y el envío de avisos | Vercel (o tu máquina) |

Nada de esto vive en el entorno donde se escribió el código: ese es temporal y
se borra. Todo lo que importa está en GitHub o en Supabase.
