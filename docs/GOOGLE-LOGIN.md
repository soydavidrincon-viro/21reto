# Activar el ingreso con Google

Son dos consolas: Google, donde se crea la credencial, y Supabase, donde se
pega. Unos 10 minutos. Es gratis, no hay cuenta de desarrollador que pagar.

Mientras no lo configures, el botón "Continuar con Google" va a fallar y la
pantalla ofrece el enlace por correo. Nadie se queda afuera, pero conviene
dejarlo listo antes de mostrarle la app a alguien.

## 1. Copia la URL de retorno desde Supabase

En el panel de Supabase: **Authentication → Providers → Google**. Ahí abajo
aparece un **Callback URL (for OAuth)** con esta forma:

```
https://jayzecnedknfichbmsce.supabase.co/auth/v1/callback
```

Cópiala. Google la va a pedir en el paso siguiente, escrita exactamente igual.

## 2. Crea la credencial en Google

1. Entra a [console.cloud.google.com](https://console.cloud.google.com).
2. Arriba a la izquierda, crea un proyecto nuevo. Nómbralo `Antidoto`.
3. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo**
   - Nombre de la app: `Antídoto`
   - Correo de asistencia y de contacto: el tuyo
   - Guarda. Puedes dejarla en modo *Prueba* mientras desarrollas, pero ojo:
     en ese modo **solo entran los correos que agregues a mano** como usuarios
     de prueba. Para abrirla a cualquiera hay que **Publicar la aplicación**.
4. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente
   de OAuth**:
   - Tipo: **Aplicación web**
   - Nombre: `Antidoto Web`
   - **URIs de redireccionamiento autorizados**: pega la URL del paso 1
5. Guarda. Google te muestra un **ID de cliente** y un **Secreto de cliente**.

## 3. Pégalos en Supabase

De vuelta en **Authentication → Providers → Google**:

- Actívalo
- **Client ID**: el ID de cliente
- **Client Secret**: el secreto
- Guarda

## 4. Comprueba que las URLs de la app estén registradas

En **Authentication → URL Configuration**, los Redirect URLs deben incluir el
`/auth/callback` de cada sitio donde corras la app:

```
http://localhost:3000/auth/callback
https://tu-url.vercel.app/auth/callback
```

Son dos URLs distintas y fáciles de confundir: la del paso 1 es la que Google
usa para hablar con Supabase; esta es la que Supabase usa para devolver a la
persona a Antídoto.

## Probar

Abre la app, dale a **Continuar con Google**, elige una cuenta. Debería llevarte
al onboarding sin pasar por ningún correo.

Si Google responde `redirect_uri_mismatch`, la URL del paso 2 no coincide
carácter por carácter con la del paso 1 — suele ser una barra de más al final.

Si entras pero vuelves al login, falta la URL del paso 4.

Si dice que la app no está verificada, es normal mientras la pantalla de
consentimiento esté en modo Prueba. Se quita al publicarla; Google solo exige
verificación formal cuando pides permisos sensibles, y aquí solo se pide el
correo y el nombre.

## Por qué Google primero y el correo como alternativa

Google no manda ningún mensaje: la dirección ya viene verificada, así que la app
no depende del servidor de correo ni de que el enlace esquive el spam.

El enlace por correo se queda porque Antídoto trackea alcohol, porno y apuestas.
Hay quien no quiere eso atado a su cuenta principal de Google, y dejarlos sin
salida sería empujarlos a algo que no querían o dejarlos fuera.

## Y Apple

Sign in with Apple para web daría lo mismo que Google **más Hide My Email**: la
app recibe una dirección intermedia y nunca ve el correo real. Para esta app en
particular eso es privacidad de verdad, no un adorno.

El freno no es técnico: exige cuenta de Apple Developer, 99 USD al año. Vale la
pena cuando decidas invertirlos.
