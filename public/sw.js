/**
 * El service worker de Antídoto.
 *
 * Solo hace una cosa: recibir los avisos y abrirlos. No intercepta peticiones a
 * propósito — cachear pantallas que dependen de la sesión y del día de hoy es
 * la forma más fácil de enseñarle a alguien una racha vieja, y una racha vieja
 * es peor que una pantalla que no carga.
 *
 * Hace falta para Android. En iPhone, desde Safari 18.4, el push puede llegar
 * sin service worker; se registra igual para no tener dos caminos distintos.
 */

// Tomar el control sin esperar a que se cierren las pestañas viejas: si no, un
// arreglo del aviso tarda hasta la siguiente vez que se cierre la app entera.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) =>
  evento.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (evento) => {
  // Sin datos no se pinta nada. Un aviso vacío o con texto de relleno es peor
  // que ninguno: enseña que la app manda cosas que no dicen nada.
  if (!evento.data) return;

  let aviso;
  try {
    aviso = evento.data.json();
  } catch {
    return;
  }
  if (!aviso?.title) return;

  evento.waitUntil(
    self.registration.showNotification(aviso.title, {
      body: aviso.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // El tag hace que un aviso reemplace al anterior en vez de apilarse. Con
      // uno al día no debería pasar nunca, pero si algún día falla el tope,
      // que falle en silencio y no en una torre de notificaciones.
      tag: "antidoto",
      data: { url: aviso.url ?? "/hoy" },
      lang: "es",
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = evento.notification.data?.url ?? "/hoy";

  evento.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Si la app ya está abierta, se reutiliza esa ventana. Abrir una segunda
      // deja dos copias de la misma app compitiendo por la misma sesión.
      for (const cliente of abiertas) {
        if ("focus" in cliente) {
          await cliente.focus();
          if ("navigate" in cliente) await cliente.navigate(destino);
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
