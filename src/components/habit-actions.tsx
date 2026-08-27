"use client";

import { Check } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { clearDay, markDay } from "@/app/(app)/hoy/actions";
import type { LogStatus } from "@/lib/types";

/**
 * Las dos acciones del día en el detalle. La recaída pide confirmación y usa
 * amarillo, no rojo: es un dato del proceso, no una falta que castigar.
 */
export function HabitActions({
  habitId,
  today,
  todayStatus,
}: {
  habitId: string;
  today: string;
  todayStatus: LogStatus | null;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const done = todayStatus === "success";
  const relapsed = todayStatus === "relapse";

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      setConfirming(false);
    });
  }

  return (
    <div className="mx-4 mt-1 flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() =>
            done ? clearDay(habitId, today) : markDay(habitId, today, "success"),
          )
        }
        className={`flex h-[54px] items-center justify-center gap-2 rounded-[16px] text-[17px] font-semibold tracking-[-0.02em] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
          done ? "bg-fill text-label" : "bg-azul text-white"
        }`}
      >
        {!done && <Check size={19} weight="bold" aria-hidden="true" />}
        {done ? "Hoy ya está marcado" : "Marcar hoy como limpio"}
      </button>

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-[14px] bg-card p-4">
          <p className="text-pretty text-[15px] leading-[1.4] tracking-[-0.01em] text-label">
            Registrar una recaída de hoy. Queda como parte de tu historial, no
            borra los días que ya llevas.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markDay(habitId, today, "relapse"))}
              className="pulsable h-11 flex-1 rounded-xl bg-ambar text-[15px] font-semibold text-[#4A3A00] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
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
          {relapsed ? "Quitar la recaída de hoy" : "Registrar una recaída"}
        </button>
      )}
    </div>
  );
}
