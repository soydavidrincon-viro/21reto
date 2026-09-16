"use client";

import { ArrowCounterClockwise, Check } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { clearDay, markDay } from "@/app/(app)/hoy/actions";
import { useCelebracion, type RetoParaCelebrar } from "@/components/celebracion";
import { HojaDeRecaida } from "@/components/hoja-de-recaida";
import { longDate } from "@/lib/dates";
import type { LogStatus } from "@/lib/types";

/**
 * Las dos acciones del día en el detalle. La recaída abre una hoja que pide
 * confirmar y deja escribir qué pasó, y usa amarillo, no rojo: es un dato del
 * proceso, no una falta que castigar.
 */
export function HabitActions({
  habitId,
  nombre,
  kind,
  today,
  todayStatus,
  cleanDays,
  reto,
}: {
  habitId: string;
  nombre: string;
  /** Lo que se deja tiene recaídas; lo que se construye, días saltados. */
  kind: "quit" | "build";
  today: string;
  todayStatus: LogStatus | null;
  /** Los días del reto que se pierden al registrar la recaída. */
  cleanDays: number;
  /** Para celebrar la meta con su premio al marcar el último día. */
  reto: RetoParaCelebrar;
}) {
  const construye = kind === "build";
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Igual que en la tarjeta de Hoy: marcar cuesta un toque, desmarcar dos.
  const [deshaciendo, setDeshaciendo] = useState(false);
  const done = todayStatus === "success";
  const relapsed = todayStatus === "relapse";
  const { celebrar, elemento } = useCelebracion();

  function run(action: () => Promise<{ error: string | null; streak?: number | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else if (result.streak !== undefined) celebrar(result.streak, reto);
      setConfirming(false);
    });
  }

  return (
    <div className="mx-4 mt-1 flex flex-col gap-1 lg:mx-0 lg:mt-0">
      {elemento}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (done && !deshaciendo) {
            setDeshaciendo(true);
            setTimeout(() => setDeshaciendo(false), 4000);
            return;
          }
          run(() =>
            done ? clearDay(habitId, today) : markDay(habitId, today, "success"),
          );
        }}
        className={`pulsable flex h-[54px] items-center justify-center gap-2 rounded-[16px] text-[17px] font-semibold tracking-[-0.02em] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
          deshaciendo
            ? "bg-ambar text-ambar-tinta"
            : done
              ? "bg-fill text-label"
              : "bg-azul text-azul-tinta"
        }`}
      >
        {deshaciendo ? (
          <ArrowCounterClockwise size={19} weight="bold" aria-hidden="true" />
        ) : (
          !done && <Check size={19} weight="bold" aria-hidden="true" />
        )}
        {deshaciendo
          ? "Toca otra vez para quitarlo"
          : done
            ? "Hoy ya está marcado"
            : construye
              ? "Marcar hoy como hecho"
              : "Marcar hoy como limpio"}
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          relapsed ? run(() => clearDay(habitId, today)) : setConfirming(true)
        }
        // Un botón de verdad, no un texto gris: es la segunda acción del
        // día y tiene que verse. Ámbar suave para no competir con el azul.
        className={`pulsable mt-1 flex h-12 items-center justify-center rounded-[16px] text-[15px] font-semibold tracking-[-0.01em] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
          relapsed ? "bg-fill text-label" : "bg-ambar/25 text-ambar-tinta"
        }`}
      >
        {relapsed
          ? construye
            ? "Quitar el día saltado"
            : "Quitar la recaída de hoy"
          : construye
            ? "Registrar que hoy me lo salté"
            : "Registrar una recaída"}
      </button>

      {confirming && (
        <HojaDeRecaida
          fecha={longDate(today)}
          subtitulo={`${nombre} · hoy`}
          titulo={construye ? "Registrar el día saltado" : "Registrar una recaída"}
          texto={
            cleanDays > 0
              ? `El reto vuelve a cero: tus ${cleanDays} ${cleanDays === 1 ? "día queda" : "días quedan"} en el historial y en tu mejor racha. Nada se borra.`
              : "El reto sigue en cero. El día queda en tu historial, en amarillo."
          }
          accion="Registrar"
          secundaria={{ label: "Cancelar", onClick: () => setConfirming(false) }}
          pending={pending}
          error={error}
          onConfirmar={(nota) =>
            run(() => markDay(habitId, today, "relapse", nota || undefined))
          }
          onClose={() => setConfirming(false)}
        />
      )}

      {error && !confirming && (
        <p role="alert" className="text-center text-[13px] leading-[1.35] text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
