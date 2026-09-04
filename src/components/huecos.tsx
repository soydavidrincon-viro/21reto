"use client";

import { useState, useTransition } from "react";
import { markDay } from "@/app/(app)/hoy/actions";
import { useCelebracion } from "@/components/celebracion";
import { longDate, shiftISO } from "@/lib/dates";
import type { DailyOverviewRow } from "@/lib/types";

/**
 * La pregunta por los días que quedaron sin marcar.
 *
 * Un día sin marcar ya no rompe la racha: la pausa. Pero tampoco se rellena
 * solo, porque entonces la app contaría días limpios que nadie confirmó. Así
 * que se pregunta, uno a uno y del más viejo al más nuevo, con un toque por
 * día. Siete días para contestar; después el hueco se queda como hueco.
 *
 * "Caí" aquí registra una recaída en ese día, con la misma política que
 * eligió la persona. No pide confirmación como el botón de emergencia porque
 * está contestando una pregunta directa, no tocando un botón grande.
 */
export function Huecos({
  habit,
  today,
  tinta,
}: {
  habit: DailyOverviewRow;
  today: string;
  /** El color de texto de la tarjeta donde vive. */
  tinta: string;
}) {
  const [contestados, setContestados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { celebrar, elemento } = useCelebracion();

  const restantes = habit.pendientes.filter((d) => !contestados.has(d));
  const dia = restantes[0];
  if (!dia) return elemento;

  const construye = habit.kind === "build";
  const cuando =
    dia === shiftISO(today, -1) ? "Ayer" : `El ${longDate(dia).toLowerCase()}`;

  function contestar(status: "success" | "relapse") {
    setError(null);
    startTransition(async () => {
      const result = await markDay(habit.habit_id, dia, status);
      if (result.error) {
        setError(result.error);
        return;
      }
      setContestados((antes) => new Set(antes).add(dia));
      if (status === "success") celebrar(result.streak);
    });
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-[16px] px-3.5 py-3"
      style={{ background: "rgba(0,0,0,0.12)" }}
    >
      {elemento}
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14px] font-semibold leading-[1.3]" style={{ color: tinta }}>
          {cuando} quedó sin marcar. {construye ? "¿Lo hiciste?" : "¿Seguiste limpio?"}
        </p>
        {restantes.length > 1 && (
          <span className="tnum shrink-0 text-[12px] opacity-70" style={{ color: tinta }}>
            y {restantes.length - 1} más
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => contestar("success")}
          className="pulsable h-11 flex-[1.4] rounded-xl bg-card text-[15px] font-semibold text-label disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          Sí
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => contestar("relapse")}
          className="pulsable h-11 flex-1 rounded-xl bg-ambar text-[15px] font-semibold text-ambar-tinta disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          {construye ? "No" : "Caí"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[13px] leading-[1.35] text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
