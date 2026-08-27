"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * Botón y enlace que se hunden al tocarlos.
 *
 * iOS da respuesta física a cada toque; sin eso la interfaz se siente muerta
 * aunque el color esté bien. El muelle es corto y duro a propósito: tiene que
 * leerse como una pulsación, no como una animación.
 */
const press = {
  whileTap: { scale: 0.965 },
  transition: { type: "spring" as const, stiffness: 700, damping: 30 },
};

export function PressableButton(props: ComponentProps<typeof motion.button>) {
  const reduced = useReducedMotion();
  return <motion.button {...(reduced ? {} : press)} {...props} />;
}

const MotionLink = motion.create(Link);

export function PressableLink(props: ComponentProps<typeof MotionLink>) {
  const reduced = useReducedMotion();
  return <MotionLink {...(reduced ? {} : press)} {...props} />;
}
