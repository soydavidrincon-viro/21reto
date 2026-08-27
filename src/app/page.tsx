"use client";

import { motion, useReducedMotion } from "motion/react";
import { ProgressRings } from "@/components/progress-rings";
import { PressableLink } from "@/components/pressable";

/**
 * La portada.
 *
 * El héroe son los anillos, no una ilustración: es el objeto que la persona va
 * a mirar todos los días, así que verlo llenarse antes de registrarse dice qué
 * hace la app mejor que cualquier frase.
 *
 * Detrás va un resplandor difuso en los colores de los anillos. Sobre negro
 * puro la pantalla se ve muerta, y un degradado de lado a lado sería el cliché
 * de siempre; esto solo levanta el fondo alrededor del héroe.
 */

const RINGS = [
  { color: "blue" as const, value: 18, goal: 21, label: "Sin alcohol" },
  { color: "orange" as const, value: 12, goal: 30, label: "Sin redes" },
  { color: "green" as const, value: 5, goal: 7, label: "Bitácora" },
];

const CLAIMS = [
  ["🎯", "Retos de 21 días", "O de 30, 60 o los que necesites."],
  ["📓", "Bitácora diaria", "Una nota y una reacción por día."],
  ["📈", "Rachas sin castigo", "La recaída se registra, no borra lo andado."],
];

export default function LandingPage() {
  const reduced = useReducedMotion();

  const enter = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <main
      className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden px-6 pb-10"
      style={{ paddingTop: "max(env(safe-area-inset-top), 40px)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[6%] size-[420px] -translate-x-1/2 rounded-full opacity-45 blur-[70px]"
        style={{
          background:
            "conic-gradient(from 210deg, var(--c-blue), var(--c-orange), var(--c-green), var(--c-blue))",
        }}
      />

      <div className="relative flex flex-1 flex-col items-center justify-center gap-8">
        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <ProgressRings rings={RINGS} size={196} />
        </motion.div>

        <div className="flex flex-col items-center gap-3 text-center">
          <motion.h1
            {...enter(0.35)}
            className="text-balance text-[42px] font-bold leading-[1.03] tracking-[-0.035em] text-label"
          >
            Un día a la vez
          </motion.h1>
          <motion.p
            {...enter(0.45)}
            className="text-pretty text-[17px] leading-[1.45] tracking-[-0.01em] text-label-2"
          >
            Lleva la cuenta de los días que llevas sin eso. Marcas el día, anotas
            cómo te fue, y la racha crece sola.
          </motion.p>
        </div>

        <ul className="flex w-full flex-col gap-2">
          {CLAIMS.map(([emoji, title, detail], i) => (
            <motion.li
              key={title}
              {...enter(0.55 + i * 0.08)}
              className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3"
            >
              <span aria-hidden="true" className="text-[24px]">
                {emoji}
              </span>
              <span className="flex flex-col gap-px">
                <span className="text-[16px] font-semibold tracking-[-0.02em] text-label">
                  {title}
                </span>
                <span className="text-[13px] tracking-[-0.01em] text-label-2">{detail}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>

      <motion.div {...enter(0.8)} className="relative flex flex-col gap-3">
        <PressableLink
          href="/login"
          className="flex h-[54px] items-center justify-center rounded-[16px] bg-blue text-[17px] font-semibold tracking-[-0.02em] text-white shadow-[0_8px_24px_-8px_var(--c-blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
        >
          Empezar
        </PressableLink>
      </motion.div>
    </main>
  );
}
