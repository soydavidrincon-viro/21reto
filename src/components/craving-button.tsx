"use client";

import { Waves } from "@phosphor-icons/react";
import { useState } from "react";
import {
  Companion,
  type CompanionEtapa,
  type CompanionKey,
} from "@/components/companion";
import { CravingSheet } from "@/components/craving-sheet";
import type { DailyOverviewRow } from "@/lib/types";

/**
 * El botón de emergencia.
 *
 * Se llamó "Ando flaqueando" y hubo que cambiarlo. "Flaquear" es de
 * diccionario y la segunda línea lo explicaba, pero esto se lee en el peor
 * momento del día: si alguien tiene que pararse a interpretar el nombre del
 * botón, el botón ya falló. "Botón de emergencia" no hay que traducirlo, y dice
 * a la vez qué es y cuándo se usa.
 *
 * Va en naranja y no escondido en un menú, por lo mismo. Y el compañero asoma
 * detrás porque este es el gesto que la app quiere premiar: aguantar es más
 * trabajo que marcar un día ya pasado.
 *
 * Solo se le enseña a quien tiene algo que dejar. Para un hábito que se
 * construye no hay antojo que aguantar —lo que falta ahí es saber qué hacer, y
 * eso son los videos del hábito—, así que ofrecerle este botón a quien solo
 * trackea "Leer" es ruido en la pantalla que más se mira.
 */
export function CravingButton({
  habits,
  companion,
  etapa,
  hoy,
}: {
  /** Solo los hábitos que se dejan. Los que se construyen no llegan aquí. */
  habits: DailyOverviewRow[];
  companion: CompanionKey;
  etapa: CompanionEtapa;
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
            Botón de emergencia
          </span>
          <span className="text-[12.5px] font-medium text-naranja-tinta opacity-75">
            {hoy === 0
              ? "Cuando sientas que estás por romper tu racha."
              : hoy === 1
                ? "Ya aguantaste uno hoy. Este también pasa."
                : `Van ${hoy} hoy. Cada uno cuenta.`}
          </span>
        </span>
        <Companion
          who={companion}
          size={58}
          mood="normal"
          etapa={etapa}
          sombra={false}
          className="flota -mb-4 -mr-1 shrink-0"
        />
      </button>

      {/* La línea que explica para qué es.
          El nombre dice cuándo se toca, pero no qué pasa después, y en un botón
          naranja que ocupa una tarjeta entera eso da miedo: parece que va a
          reiniciar la racha o a llamar a alguien. Así que lo primero que dice
          es lo que NO hace, que es la duda que frena el dedo. */}
      <p className="mt-1.5 px-1 text-pretty text-[12.5px] leading-[1.4] text-label-2">
        No rompe tu racha: solo queda anotado el momento.
      </p>

      {abierto && (
        <CravingSheet habits={habits} onClose={() => setAbierto(false)} />
      )}
    </>
  );
}
