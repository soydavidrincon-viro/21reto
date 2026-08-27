"use client";

import { Confetti } from "@phosphor-icons/react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { milestoneCopy } from "@/lib/milestones";

/**
 * Se muestra al alcanzar un hito y se va sola.
 *
 * El confetti sale en los colores de la app, no en el arcoíris por defecto de
 * la librería. Y respeta prefers-reduced-motion: quien pidió menos movimiento
 * ve la tarjeta sin la lluvia de partículas, no una animación atenuada.
 */
export function MilestoneCelebration({
  day,
  onDone,
}: {
  day: number | null;
  onDone: () => void;
}) {
  useEffect(() => {
    if (day === null) return;

    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!quiet) {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.35 },
        colors: ["#2D5BFF", "#FF6B2C", "#00C9A7", "#FFC53D", "#7B61FF"],
        disableForReducedMotion: true,
      });
    }

    const timer = setTimeout(onDone, 4200);
    return () => clearTimeout(timer);
  }, [day, onDone]);

  const copy = day === null ? null : milestoneCopy(day);

  return (
    <AnimatePresence>
      {copy && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="fixed inset-x-4 z-50 mx-auto max-w-[398px] rounded-2xl bg-card p-4 shadow-lg"
          style={{ top: "max(env(safe-area-inset-top), 16px)" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-ambar text-ambar-tinta">
              <Confetti size={24} weight="fill" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[17px] font-semibold tracking-[-0.02em] text-label">
                {copy.title}
              </span>
              <span className="text-pretty text-[13px] leading-[1.35] text-label-2">
                {copy.detail}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
