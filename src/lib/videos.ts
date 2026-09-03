/**
 * Los enlaces de video de un hábito.
 *
 * Nada de esto toca la red: la app no va a pedirle el título a YouTube ni a
 * nadie. Sacar el título de verdad exige llamar a una API con clave, y por un
 * dato cosmético no vale la pena ni el secreto ni la dependencia de que un
 * servicio ajeno esté arriba. Con el nombre del sitio alcanza para distinguir
 * un enlace de otro en la lista.
 */

export const MAX_VIDEOS_POR_HABITO = 20;

/**
 * Deja el enlace listo para guardar, o devuelve null si no sirve.
 *
 * Solo http y https. Es la barrera que impide que un `javascript:` acabe en un
 * `href`, y se comprueba con el parser del navegador en vez de con una expresión
 * regular porque las URL tienen más formas raras de las que uno se acuerda.
 */
export function normalizarEnlace(entrada: string): string | null {
  const texto = entrada.trim();
  if (!texto || texto.length > 2000) return null;

  // Quien copia del navegador pega "youtube.com/watch?v=…" sin el esquema. Es
  // el caso normal, no un error, así que se completa en vez de rechazarlo.
  const conEsquema = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`;

  try {
    const url = new URL(conEsquema);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** De dónde sale el video, para cuando no le pusieron título. */
export function deDondeEs(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const conocidos: Record<string, string> = {
      "youtube.com": "YouTube",
      "m.youtube.com": "YouTube",
      "youtu.be": "YouTube",
      "vimeo.com": "Vimeo",
      "tiktok.com": "TikTok",
      "instagram.com": "Instagram",
      "twitch.tv": "Twitch",
      "drive.google.com": "Drive",
    };
    return conocidos[host] ?? host;
  } catch {
    return "Enlace";
  }
}

export type HabitVideo = {
  id: string;
  url: string;
  title: string | null;
};
