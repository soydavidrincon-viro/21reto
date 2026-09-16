"use client";

import { Gift, Trophy } from "@phosphor-icons/react";
import confetti from "canvas-confetti";
import { useEffect } from "react";
import type { RetoParaCelebrar } from "@/components/celebracion";
import { Portal, useHojaModal } from "@/components/portal";
import { comoSeLee, HABIT_HEX } from "@/lib/types";

/** Los cinco acentos de la app, una vez cada uno. `pink` repite el naranja. */
const COLORES = [...new Set(Object.values(HABIT_HEX))];

/**
 * Se acaba de marcar el día que completa el reto.
 *
 * A diferencia de los hitos, que son un aviso que se va solo, esto es un
 * modal: es el momento del premio, y se cierra cuando la persona quiere. El
 * confetti respeta prefers-reduced-motion igual que en los hitos.
 */
export function MetaCumplida({
  reto,
  onDone,
}: {
  reto: RetoParaCelebrar;
  onDone: () => void;
}) {
  const hoja = useHojaModal(onDone);

  useEffect(() => {
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quiet) return;
    confetti({
      particleCount: 140,
      spread: 80,
      origin: { y: 0.4 },
      colors: COLORES,
      disableForReducedMotion: true,
    });
  }, []);

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
        <div
          aria-hidden="true"
          onClick={onDone}
          className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        />

        <div
          ref={hoja}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Llegaste a tu meta"
          className="entrar relative flex w-full max-w-[460px] flex-col gap-4 rounded-t-[28px] bg-card p-5 outline-none sm:rounded-[28px]"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
        >
          <span className="flex size-14 items-center justify-center rounded-[18px] bg-naranja text-naranja-tinta">
            <Trophy size={30} weight="fill" aria-hidden="true" />
          </span>

          <div className="flex flex-col gap-1.5">
            <h2 className="text-balance font-display text-[26px] font-semibold leading-[1.1] tracking-[-0.01em] text-label">
              Llegaste a tu meta
            </h2>
            <p className="text-pretty text-[15px] leading-[1.4] text-label-2">
              {reto.targetDays} {reto.targetDays === 1 ? "día" : "días"}{" "}
              {comoSeLee(reto.kind, reto.nombre)}. Ninguno se marcó solo.
            </p>
          </div>

          {reto.premio ? (
            <div className="flex items-start gap-3 rounded-[16px] bg-fill px-3.5 py-3.5">
              <Gift
                size={26}
                weight="fill"
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-naranja"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-label-2">
                  Te lo ganaste
                </span>
                <p className="text-pretty font-display text-[18px] font-medium leading-[1.3] text-label">
                  “{reto.premio}”
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[14.5px] leading-[1.4] text-label-2">
              Tu reto está cumplido. En Hoy eliges qué sigue.
            </p>
          )}

          <button
            type="button"
            onClick={onDone}
            className="pulsable h-[52px] rounded-[16px] bg-azul text-[16px] font-semibold text-azul-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            {reto.premio ? "Ir por él" : "Listo"}
          </button>
        </div>
      </div>
    </Portal>
  );
}
