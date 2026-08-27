"use client";

import { Waves } from "@phosphor-icons/react";
import { useState } from "react";
import { Companion, type CompanionKey } from "@/components/companion";
import { CravingSheet } from "@/components/craving-sheet";
import type { DailyOverviewRow } from "@/lib/types";

/**
 * El botón de emergencia de la app.
 *
 * Va arriba y en naranja, no escondido en un menú: el momento en que sirve es
 * el momento en que menos ganas hay de buscarlo. Y el compañero asoma detrás
 * porque este es el gesto que la app quiere premiar — aguantar es más trabajo
 * que marcar un día ya pasado.
 *
 * "Ando flaqueando" y no "estoy cayendo": el botón es para el momento de
 * antes, cuando todavía no ha pasado nada. Ponerle nombre de derrota a ese
 * momento sería declarar perdido a quien justamente vino a no perderlo — y
 * además chocaría con el botón "Caí" que vive dentro de la hoja.
 *
 * La segunda línea del primer estado explica la palabra. "Flaquear" es de
 * diccionario y se entiende en todas partes, pero esto se lee en el peor
 * momento del día y ahí nadie quiere ponerse a interpretar vocabulario.
 */
export function CravingButton({
  habits,
  companion,
  hoy,
}: {
  habits: DailyOverviewRow[];
  companion: CompanionKey;
  /** Cuántos antojos van hoy. Cambia el texto: el primero no es el tercero. */
  hoy: number;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="pulsable relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] bg-naranja px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-black/15 text-naranja-tinta">
          <Waves size={24} weight="fill" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-naranja-tinta">
            Ando flaqueando
          </span>
          <span className="text-[12.5px] font-medium text-naranja-tinta opacity-75">
            {hoy === 0
              ? "Estás a punto y no has caído. Regístralo."
              : hoy === 1
                ? "Ya aguantaste uno hoy. Este también pasa."
                : `Van ${hoy} hoy. Cada uno cuenta.`}
          </span>
        </span>
        <Companion
          who={companion}
          size={58}
          mood="normal"
          sombra={false}
          className="flota -mb-4 -mr-1 shrink-0"
        />
      </button>

      {abierto && (
        <CravingSheet habits={habits} onClose={() => setAbierto(false)} />
      )}
    </>
  );
}
