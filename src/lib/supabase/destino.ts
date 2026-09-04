/**
 * A dónde volver después de entrar.
 *
 * El proxy manda al login con `?next=/habito/abc`, y el login guarda ese
 * destino en una cookie corta antes de pedir el enlace o abrir Google. La ruta
 * de retorno lo lee y borra la cookie. Antes el parámetro se generaba y nadie
 * lo leía: cualquier enlace profundo —un aviso que abre un hábito, un marcador—
 * acababa en Hoy.
 */
export const COOKIE_DESTINO = "antidoto-destino";

/**
 * Solo rutas de esta misma app.
 *
 * Tiene que empezar por una sola barra: `//evil.com` es una URL relativa al
 * protocolo y `@evil.com` pegado al origen cambia de host. Cualquier cosa que
 * no sea un camino interno cae a Hoy. Y nunca el propio login ni la ruta de
 * retorno, que serían un bucle.
 */
export function destinoSeguro(valor: string | null | undefined): string {
  if (!valor || valor.length > 512) return "/hoy";
  if (!/^\/[^\/\\]/.test(valor)) return "/hoy";
  // Solo lo que cabe en una ruta de esta app. Viaja dentro de una cookie sin
  // codificar, así que tampoco puede llevar `;`, espacios ni nada raro.
  if (!/^[A-Za-z0-9\/_\-.?=&]+$/.test(valor)) return "/hoy";
  if (valor.startsWith("/login") || valor.startsWith("/auth")) return "/hoy";
  return valor;
}
