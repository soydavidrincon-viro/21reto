"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { milestoneReached } from "@/lib/milestones";

/*
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

const MetaCumplida = dynamic(
  () => import("@/components/meta-cumplida").then((m) => m.MetaCumplida),
  { ssr: false },
);

/** Lo que hace falta saber del reto para celebrar la meta con su premio. */
export type RetoParaCelebrar = {
  nombre: string;
  kind: "quit" | "build";
  targetDays: number;
  premio: string | null;
};

/**
 * Un hito se celebra desde cualquier sitio donde se marque un día: la tarjeta
 * de Hoy, el detalle, el calendario. Antes solo la tarjeta lo hacía, así que
 * llegar a la semana desde el calendario no decía nada.
 *
 * Dos celebraciones distintas: la meta del reto es un modal con el premio (y
 * gana si coincide con un hito); los hitos fijos son un aviso que se va solo.
 *
 * Devuelve la función que hay que llamar con la racha que devolvió `markDay`
 * y el elemento que hay que pintar.
 */
export function useCelebracion() {
  const [dia, setDia] = useState<number | null>(null);
  const [meta, setMeta] = useState<RetoParaCelebrar | null>(null);

  function celebrar(streak: number | null, reto?: RetoParaCelebrar) {
    if (streak === null) return;
    if (reto && streak === reto.targetDays) {
      setMeta(reto);
      return;
    }
    const hito = milestoneReached(streak);
    if (hito !== null) setDia(hito);
  }

  const elemento = meta ? (
    <MetaCumplida reto={meta} onDone={() => setMeta(null)} />
  ) : dia === null ? null : (
    <MilestoneCelebration day={dia} onDone={() => setDia(null)} />
  );

  return { celebrar, elemento };
}
