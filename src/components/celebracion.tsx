"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { milestoneReached } from "@/lib/milestones";

/**
 * La celebración se carga solo cuando hay algo que celebrar.
 *
 * Trae `motion` y `canvas-confetti`, y montada siempre las dos librerías
 * viajaban en el bundle inicial de Hoy los 364 días del año en que no se llega
 * a ningún hito. Con `dynamic` se bajan la primera vez que alguien llega a uno.
 */
const MilestoneCelebration = dynamic(
  () =>
    import("@/components/milestone-celebration").then(
      (m) => m.MilestoneCelebration,
    ),
  { ssr: false },
);

/**
 * Un hito se celebra desde cualquier sitio donde se marque un día: la tarjeta
 * de Hoy, el detalle, el calendario, la respuesta a un hueco. Antes solo la
 * tarjeta lo hacía, así que llegar a la semana desde el calendario no decía
 * nada.
 *
 * Devuelve la función que hay que llamar con la racha que devolvió `markDay`
 * y el elemento que hay que pintar.
 */
export function useCelebracion() {
  const [dia, setDia] = useState<number | null>(null);

  function celebrar(streak: number | null) {
    if (streak === null) return;
    const hito = milestoneReached(streak);
    if (hito !== null) setDia(hito);
  }

  const elemento =
    dia === null ? null : (
      <MilestoneCelebration day={dia} onDone={() => setDia(null)} />
    );

  return { celebrar, elemento };
}
