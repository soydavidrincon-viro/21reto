"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { setHabitDows } from "@/app/actions/habits";
import {
  comoSeLeenLosDias,
  DOW_INICIALES,
  DOW_LABELS,
} from "@/lib/types";

/**
 * Los días en que toca un hábito, editables desde su detalle.
 *
 * Existe porque sin esto la elección de días solo valdría para los hábitos
 * nuevos, y quien ya tenía "Ejercicio" creado tendría que borrarlo y volver a
 * hacerlo —perdiendo todo el historial— para poder decir que va martes y
 * jueves. Cambiar de idea sobre qué días vas al gimnasio es lo más normal del
 * mundo y no debería costar el progreso.
 *
 * Solo se pinta en los hábitos que se construyen: lo que se deja se deja todos
 * los días.
 */
export function DiasDelHabito({
  habitId,
  inicial,
}: {
  habitId: string;
  inicial: number[];
}) {
  const [dows, setDows] = useState<number[]>(inicial);
  const [guardado, setGuardado] = useState<number[]>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sucio =
    dows.length !== guardado.length ||
    dows.some((d) => !guardado.includes(d));

  function guardar() {
    setError(null);
    startTransition(async () => {
      const r = await setHabitDows(habitId, dows);
      if (r.error) setError(r.error);
      else setGuardado(dows);
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-[22px] bg-card px-4 py-4 lg:px-5 lg:py-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-label">
          Qué días toca
        </h2>
        <span className="text-[13px] text-label-2">
          {dows.length === 0 ? "Elige al menos uno" : comoSeLeenLosDias(dows)}
        </span>
      </div>

      <div
        role="group"
        aria-label="Días de la semana en que toca"
        className="flex gap-1.5"
      >
        {/* De lunes a domingo, que es como se lee una semana en español,
            aunque por dentro el domingo siga siendo el 0. */}
        {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
          const activo = dows.includes(dow);
          return (
            <button
              key={dow}
              type="button"
              aria-pressed={activo}
              aria-label={DOW_LABELS[dow]}
              onClick={() =>
                setDows((antes) =>
                  antes.includes(dow)
                    ? antes.filter((d) => d !== dow)
                    : [...antes, dow],
                )
              }
              className={`pulsable flex h-11 w-full items-center justify-center rounded-[14px] text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                activo ? "bg-azul text-azul-tinta" : "bg-fill text-label-3"
              }`}
            >
              {DOW_INICIALES[dow]}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-[13px] leading-[1.35] text-rojo">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-pretty text-[12.5px] leading-[1.4] text-label-2">
          Los días que no elijas no te piden marcar ni te rompen la racha. Lo
          que ya marcaste se queda.
        </p>
        {(sucio || pending) && (
          <button
            type="button"
            onClick={guardar}
            disabled={pending || dows.length === 0}
            className="pulsable h-10 shrink-0 rounded-xl bg-azul px-4 text-[14px] font-semibold text-azul-tinta disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        )}
        {!sucio && !pending && guardado !== inicial && (
          <span
            aria-live="polite"
            className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-medium text-menta"
          >
            <CheckCircle size={15} weight="fill" aria-hidden="true" />
            Guardado
          </span>
        )}
      </div>
    </section>
  );
}
