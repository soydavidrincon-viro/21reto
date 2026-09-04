"use client";

import { ArrowCounterClockwise, Check } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { clearDay, markDay } from "@/app/(app)/hoy/actions";
import type { LogStatus } from "@/lib/types";

/**
 * Las dos acciones del día en el detalle. La recaída pide confirmación y usa
 * amarillo, no rojo: es un dato del proceso, no una falta que castigar.
 */
export function HabitActions({
  habitId,
  kind,
  today,
  todayStatus,
}: {
  habitId: string;
  /** Lo que se deja tiene recaídas; lo que se construye, días saltados. */
  kind: "quit" | "build";
  today: string;
  todayStatus: LogStatus | null;
}) {
  const construye = kind === "build";
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Igual que en la tarjeta de Hoy: marcar cuesta un toque, desmarcar dos.
  const [deshaciendo, setDeshaciendo] = useState(false);
  const done = todayStatus === "success";
  const relapsed = todayStatus === "relapse";

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  return (
    <div className="mx-4 mt-1 flex flex-col gap-1 lg:mx-0 lg:mt-0">
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

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-[14px] bg-card p-4">
          <p className="text-pretty text-[15px] leading-[1.4] tracking-[-0.01em] text-label">
            {construye
              ? "Registrar que hoy te lo saltaste. Queda como parte de tu historial, no borra los días que ya llevas."
              : "Registrar una recaída de hoy. Queda como parte de tu historial, no borra los días que ya llevas."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markDay(habitId, today, "relapse"))}
              className="pulsable h-11 flex-1 rounded-xl bg-ambar text-[15px] font-semibold text-ambar-tinta disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Sí, registrar
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="pulsable h-11 flex-1 rounded-xl bg-fill text-[15px] font-semibold text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            relapsed ? run(() => clearDay(habitId, today)) : setConfirming(true)
          }
          className="flex h-11 items-center justify-center text-[15px] font-medium tracking-[-0.01em] text-label-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          {relapsed
            ? construye
              ? "Quitar el día saltado"
              : "Quitar la recaída de hoy"
            : construye
              ? "Registrar que hoy me lo salté"
              : "Registrar una recaída"}
        </button>
      )}

      {error && (
        <p role="alert" className="text-center text-[13px] leading-[1.35] text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
