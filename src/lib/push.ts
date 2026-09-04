/**
 * El lado del navegador de los recordatorios.
 *
 * Todo lo de aquí toca APIs que no existen en el servidor ni en todos los
 * navegadores, así que cada función comprueba antes de tocar nada. Un `if` de
 * más aquí es una pantalla que no revienta en el Safari de alguien.
 */

/** ¿Este navegador puede recibir avisos? */
export function soportaAvisos(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** ¿Está abierta como app instalada y no como pestaña? */
export function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari en iOS no implementa display-mode; usa esta propiedad suya.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function esIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPad moderno se declara Mac; el táctil lo delata.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * En iPhone el push solo llega si la app está en la pantalla de inicio. Desde
 * una pestaña de Safari no llega nada, y Safari no ofrece el botón de
 * instalar: hay que enseñárselo a la persona.
 */
export function iphoneSinInstalar(): boolean {
  return esIOS() && !estaInstalada();
}

/** La clave pública viaja en el bundle; es pública por diseño. */
const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** base64url -> Uint8Array, que es lo que pide `subscribe`. */
function aBytes(base64url: string): Uint8Array {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(base64);
  const bytes = new Uint8Array(crudo.length);
  for (let i = 0; i < crudo.length; i += 1) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

export type Suscripcion = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
};

function aTexto(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/**
 * Pide permiso, registra el service worker y devuelve la suscripción.
 *
 * Devuelve null si la persona dice que no, y eso no es un error: es una
 * respuesta. Quien dice que no a los avisos tiene que poder seguir usando la
 * app sin que nada se rompa ni se le vuelva a preguntar.
 */
export async function suscribirse(): Promise<Suscripcion | null> {
  if (!soportaAvisos() || !CLAVE_PUBLICA) return null;

  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return null;

  const registro = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  // Si ya había una suscripción se reutiliza: volver a suscribir genera un
  // endpoint nuevo y deja el viejo colgando en la base recibiendo para siempre.
  const suscripcion =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: aBytes(CLAVE_PUBLICA) as BufferSource,
    }));

  return {
    endpoint: suscripcion.endpoint,
    p256dh: aTexto(suscripcion.getKey("p256dh")),
    auth: aTexto(suscripcion.getKey("auth")),
    userAgent: navigator.userAgent.slice(0, 200),
  };
}

/** Suelta la suscripción de este dispositivo. Devuelve el endpoint que había. */
export async function desuscribirse(): Promise<string | null> {
  if (!soportaAvisos()) return null;

  const registro = await navigator.serviceWorker.getRegistration();
  const suscripcion = await registro?.pushManager.getSubscription();
  if (!suscripcion) return null;

  const endpoint = suscripcion.endpoint;
  await suscripcion.unsubscribe();
  return endpoint;
}

/** El estado del permiso, para saber qué enseñar antes de pedir nada. */
export function permisoActual(): NotificationPermission | "sin-soporte" {
  if (!soportaAvisos()) return "sin-soporte";
  return Notification.permission;
}
