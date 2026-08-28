"use client";

import { useLayoutEffect } from "react";

/** Lee el tema guardado. Devuelve null cuando toca seguir al sistema. */
export function temaGuardado(): "light" | "dark" | null {
  const m = document.cookie.match(/(?:^|; )theme=(light|dark)/);
  return m ? (m[1] as "light" | "dark") : null;
}

/** Aplica un tema al `<html>` y lo deja guardado por un año. */
export function aplicarTema(theme: "system" | "light" | "dark") {
  const raiz = document.documentElement;
  if (theme === "system") raiz.removeAttribute("data-theme");
  else raiz.setAttribute("data-theme", theme);

  // Se escribe también aquí, y no solo en la acción de servidor, para que el
  // cambio aguante una recarga inmediata: la acción tarda un viaje de red, y
  // recargar antes de que vuelva dejaba el tema anterior.
  document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * Vuelve a poner `data-theme` después de que React limpie el `<html>`.
 *
 * En desarrollo, el Strict Mode monta cada componente dos veces, y en ese
 * segundo montaje React deja en `<html>` solo los atributos que salen de su
 * JSX — borrando el que puso el script en línea del layout. El resultado es que
 * en `npm run dev` la app se veía en tema del sistema por mucho que hubieras
 * elegido oscuro.
 *
 * En producción no hay remontaje, así que esto no llega a hacer nada: el
 * atributo ya está puesto y se le vuelve a poner el mismo valor.
 *
 * useLayoutEffect y no useEffect: corre antes del pintado, así que no se
 * alcanza a ver el tema equivocado ni un fotograma.
 */
export function TemaGuardia() {
  useLayoutEffect(() => {
    const t = temaGuardado();
    if (t) document.documentElement.setAttribute("data-theme", t);
  }, []);

  return null;
}
