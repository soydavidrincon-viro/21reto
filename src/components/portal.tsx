"use client";

import { useEffect, useRef } from "react";
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

const ENFOCABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Lo que una hoja modal le debe al teclado y al lector de pantalla.
 *
 * Las cuatro hojas de la app decían `aria-modal="true"` y no hacían nada de lo
 * que eso promete: el foco se quedaba en el botón de atrás, Escape no cerraba,
 * y Tab se iba a la página de debajo mientras el lector de pantalla juraba que
 * esa página no existía. Esto lo arregla en un sitio para las cuatro:
 *
 * - al abrir, el foco entra en la hoja y se recuerda dónde estaba;
 * - Escape cierra;
 * - Tab y Shift+Tab dan la vuelta dentro de la hoja;
 * - al cerrar, el foco vuelve al botón que la abrió y la página recupera el
 *   scroll, que se bloquea mientras la hoja está encima.
 *
 * Se devuelve la ref para el `<div role="dialog">`, que necesita
 * `tabIndex={-1}` para poder recibir el foco.
 */
export function useHojaModal(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  // El cierre se lee desde una ref para que el efecto de abajo corra una sola
  // vez: si dependiera de `onClose` —una función nueva en cada render— volvería
  // a enfocar la hoja en cada pulsación y le quitaría el foco al campo de
  // texto. La ref se actualiza en su propio efecto, nunca durante el render.
  const cerrar = useRef(onClose);
  useEffect(() => {
    cerrar.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const hoja = ref.current;
    if (!hoja) return;

    const anterior = document.activeElement as HTMLElement | null;
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Primero al primer control de verdad; si no hay, a la hoja entera.
    const primero = hoja.querySelector<HTMLElement>(ENFOCABLE);
    (primero ?? hoja).focus({ preventScroll: true });

    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        cerrar.current();
        return;
      }
      if (evento.key !== "Tab" || !hoja) return;

      const controles = [...hoja.querySelectorAll<HTMLElement>(ENFOCABLE)];
      if (controles.length === 0) {
        evento.preventDefault();
        return;
      }
      const inicio = controles[0];
      const fin = controles[controles.length - 1];
      const activo = document.activeElement;

      if (evento.shiftKey && (activo === inicio || activo === hoja)) {
        evento.preventDefault();
        fin.focus();
      } else if (!evento.shiftKey && activo === fin) {
        evento.preventDefault();
        inicio.focus();
      }
    }

    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = desbordeAnterior;
      anterior?.focus?.({ preventScroll: true });
    };
  }, []);

  return ref;
}
