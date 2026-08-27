/**
 * Las cabeceras con las que el middleware le dice a la página quién entró.
 *
 * Sin esto, cada navegación hacía DOS viajes al servidor de auth: uno en el
 * middleware y otro dentro de la página. El primero ya validó el token contra
 * Supabase, así que repetirlo es pagar la misma latencia dos veces por
 * pantalla, y eso es la mitad de lo que se siente al cambiar de pestaña.
 *
 * Viven en su propio archivo para que una página pueda leerlas sin arrastrar
 * el middleware entero —y `next/server` con él— a su bundle.
 */
export const CABECERA_USUARIO = "x-antidoto-user";
export const CABECERA_EMAIL = "x-antidoto-email";
