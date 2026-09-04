# Cuentas y seguridad

Qué protege hoy los datos de cada persona, qué falta antes de abrirle la app a
gente real, y por qué está diseñado así.

## No hay contraseñas, y es a propósito

Antídoto entra por *magic link*: escribes tu correo, te llega un enlace, entras.
No existe una contraseña que guardar, que filtrar ni que olvidar.

Eso responde la pregunta de "¿y si se le pierde la cuenta?" — **el mecanismo de
recuperación es el mismo que el de entrada**. Quien no puede entrar simplemente
pide otro enlace. No hay flujo de "olvidé mi contraseña" porque no hay nada que
olvidar.

Lo que sí es cierto y conviene decir en voz alta: **quien pierde el acceso a su
correo pierde la cuenta.** Eso pasa igual con contraseñas, y por eso vale la
pena agregar Google y Apple como segunda vía de entrada (ver más abajo).

## Qué está verificado ahora mismo

Estas no son afirmaciones de diseño, son pruebas corridas contra el proyecto
real y contra un Postgres local:

- **Aislamiento entre cuentas.** Con dos usuarios distintos, cada uno ve cero
  filas del otro en `habits`, `habit_logs`, `journal_entries`, `cravings`,
  `push_subscriptions` y `notification_log`. Lo impone Postgres con Row Level
  Security, no el código de la app: aunque alguien llamara la API directamente
  con la llave pública, no obtiene datos ajenos.
- **Escritura sin sesión rechazada.** Las políticas de escritura exigen que
  `auth.uid()` coincida con `user_id`, y sin sesión `auth.uid()` es nulo, así
  que nada coincide. (Las pruebas del repo lo ejercitan con sesiones cruzadas;
  el caso sin sesión se comprobó a mano contra el proyecto real.)
- **No se puede escribir sobre el hábito de otro.** Encontramos ese agujero
  probando: la política solo verificaba que el `user_id` fuera el de quien
  escribe, así que se podían colgar registros del hábito de otra persona.
  Se cerró con una llave foránea compuesta `(habit_id, user_id)`, de modo que
  lo garantiza el esquema y no una política que se pueda olvidar mañana.
- **Nadie puede quedarse con el dispositivo de otro.** El endpoint de una
  suscripción push es único en el mundo. La política de actualización exige
  que la fila sea tuya antes y después del cambio, así que un upsert sobre un
  endpoint ajeno se rechaza. Sin eso, alguien podría recibir los avisos de
  otra persona, que llevan el nombre de sus hábitos.
- **Una zona horaria inválida no entra.** Un trigger la comprueba al guardar.
  No es cosmética: los recordatorios de todo el mundo se calculan con la zona
  de cada perfil, y uno solo inválido dejaba la función entera sin poder correr.
- **Borrado de cuenta.** Elimina en cascada perfil, hábitos, registros,
  bitácora, impulsos y dispositivos, y no toca ninguna otra cuenta. La función
  saca el id de la sesión en vez de recibirlo como parámetro, así que nadie
  puede pedir el borrado de otro.
- **La sesión se valida contra el servidor.** El proxy usa `getUser()` y no
  `getSession()`: comprueba el token con el servidor de auth en cada request en
  vez de creerle a la cookie.
- **Las acciones no se fían de lo que les llega.** Zona horaria, fechas,
  estados, metas y caras se comprueban contra listas cerradas antes de tocar
  Postgres, y las fechas no pueden ser futuras respecto al hoy de la persona.
- **El destino después de entrar es siempre interno.** Solo se acepta un
  camino que empiece por una barra y no sea el login: `//otro.sitio` o
  `@otro.sitio` caen a Hoy.

Las pruebas viven en `supabase/tests/` y se pueden volver a correr.

## Sobre la llave que va en el navegador

`NEXT_PUBLIC_SUPABASE_ANON_KEY` viaja al navegador de cada visitante. Eso es
correcto y no es una filtración: es lo que Supabase llama *publishable key*, y
lo único que permite es hablar con la API. Quién ve qué lo deciden las políticas
RLS del esquema.

La que **no** debe salir del panel es la *secret key* (antes `service_role`):
esa sí se salta todas las políticas.

## Qué falta antes de abrirla a usuarios reales

**1. Servidor de correo propio — esto es bloqueante.**
El correo que Supabase da gratis manda unos pocos mensajes por hora y cae en
spam con frecuencia. Con gente real, los registros van a fallar en silencio: la
persona pide el enlace, no le llega, y se va. Conecta un SMTP en
*Project Settings → Auth → SMTP Settings*. [Resend](https://resend.com) tiene
plan gratuito suficiente para empezar y se configura en unos minutos.

**2. Ingreso con Google.**
Ya está construido; falta configurarlo — los pasos están en
[`GOOGLE-LOGIN.md`](GOOGLE-LOGIN.md). Es gratis y quita el problema del correo
de raíz: Google ya verificó la dirección, así que la app no manda nada. Si la
mayoría entra por ahí, el volumen de correos se desploma y el SMTP deja de ser
bloqueante.

Sobre la casilla de **confirmar correo**: aplica al registro con contraseña, que
esta app no usa. Con enlace por correo, abrir el enlace ya demuestra que la
persona controla ese buzón — esa *es* la confirmación, no hay un paso extra.

**3. Las URLs de producción.**
En *Authentication → URL Configuration*, la Site URL y los Redirect URLs deben
ser los del dominio real. Un redirect mal puesto no es solo un login roto: es la
puerta por la que se cuelan los ataques de redirección abierta.

## Lo que la app deliberadamente no hace

- **No guarda nada sensible más allá de lo que la persona escribe.** No hay
  ubicación, ni contactos, ni analítica de terceros.
- **No comparte datos entre usuarios.** No hay perfiles públicos ni ranking; la
  bitácora de alguien no la ve nadie más.
- **Puede llevarse sus datos y borrarlos.** Exportación a JSON y borrado
  definitivo están en Perfil, sin pedirlo por correo ni esperar aprobación.
