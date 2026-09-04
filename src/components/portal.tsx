"use client";

import { createPortal } from "react-dom";

/**
 * Saca una hoja modal del sitio del árbol donde se escribió y la cuelga del
 * `<body>`.
 *
 * Hace falta por una regla de CSS que muerde en silencio: `position: fixed` no
 * se posiciona respecto a la pantalla si algún ancestro tiene `transform`,
 * `filter` o `backdrop-filter` — ese ancestro pasa a ser el marco de
 * referencia. La barra superior del detalle de hábito lleva `backdrop-blur`,
 * así que la hoja de archivar/eliminar se abría dentro de una franja de 44px de
 * alto, recortada y sin fondo oscuro. Se veía como si la app estuviera rota.
 *
 * Colgarla del body la deja fuera del alcance de cualquier ancestro raro, hoy y
 * el día que alguien añada un blur en otro sitio.
 *
 * No hace falta comprobar si estamos en el servidor: las hojas se pintan solo
 * cuando alguien las abre, y eso no pasa nunca durante el render del servidor.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
