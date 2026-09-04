"use client";

import { useEffect } from "react";
import { Logo } from "@/components/logo";

/**
 * Lo que se ve cuando algo revienta de verdad.
 *
 * Sin esto, cualquier excepción en una página —una consulta que falla, un
 * dato que no cuadra— era la pantalla gris de Next con "Application error" en
 * inglés, sin logo, sin botón y sin decir qué hacer. Para una app que alguien
 * abre en un mal momento, eso es peor que el error.
 *
 * No se enseña el mensaje técnico: no ayuda a quien lo lee y a veces trae
 * nombres de tablas. Se manda a la consola, que es donde sí sirve.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ paddingTop: "max(env(safe-area-inset-top), 40px)" }}
    >
      <Logo size={26} />
      <div className="flex flex-col gap-2">
        <h1 className="text-balance font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-label">
          Algo se rompió de nuestro lado
        </h1>
        <p className="text-pretty text-[15px] leading-[1.45] text-label-2">
          No es nada que hayas hecho tú y no se perdió nada de lo que llevas.
          Vuelve a intentarlo en un momento.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="pulsable flex h-[54px] items-center justify-center rounded-[16px] bg-azul text-[17px] font-semibold tracking-[-0.02em] text-azul-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          Volver a intentar
        </button>
        <a
          href="/hoy"
          className="flex h-[48px] items-center justify-center rounded-[16px] text-[15px] font-semibold text-azul focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          Ir a Hoy
        </a>
      </div>
    </main>
  );
}
