"use client";

import { useState, useTransition } from "react";
import { clearDay, markDay } from "@/app/(app)/hoy/actions";
import { longDate } from "@/lib/dates";
import type { LogStatus } from "@/lib/types";

/**
 * El mes del hábito, con los días editables.
 *
 * Cualquier día pasado se puede tocar para corregirlo: olvidarse de marcar es
 * lo más común que le pasa a alguien que lleva un conteo, y sin esto la racha
 * quedaba rota por un descuido y no por una recaída. Los días futuros no.
 */
export function MonthHeatmap({
  habitId,
  days,
  today,
  initial,
}: {
  habitId: string;
  days: (string | null)[];
  today: string;
  initial: Record<string, LogStatus>;
}) {
  const [status, setStatus] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply(date: string, next: LogStatus | null) {
    setStatus((current) => {
      const copy = { ...current };
      if (next === null) delete copy[date];
      else copy[date] = next;
      return copy;
    });
    setEditing(null);

    startTransition(async () => {
      if (next === null) await clearDay(habitId, date);
      else await markDay(habitId, date, next);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1.5" aria-hidden="true">
        {["L", "M", "M", "J", "V", "S", "D"].map((initialLetter, i) => (
          <span
            key={i}
            className="mx-auto w-full max-w-[42px] text-center text-[10.5px] font-semibold text-label-2"
          >
            {initialLetter}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((date, i) => {
          if (!date) return <span key={`hueco-${i}`} aria-hidden="true" />;

          const state = status[date];
          const isToday = date === today;
          const future = date > today;

          const tone =
            state === "success"
              ? "bg-azul text-azul-tinta"
              : state === "relapse"
                ? "bg-ambar text-[#4A3A00]"
                : isToday
                  ? "bg-card text-azul ring-2 ring-azul ring-inset"
                  : "bg-fill text-label-3";

          return (
            <button
              key={date}
              type="button"
              disabled={future || pending}
              onClick={() => setEditing(editing === date ? null : date)}
              aria-label={`${longDate(date)}: ${
                state === "success"
                  ? "limpio"
                  : state === "relapse"
                    ? "recaída"
                    : future
                      ? "por venir"
                      : "sin registro, tocar para marcar"
              }`}
              className={`tnum flex aspect-square w-full max-w-[42px] items-center justify-center justify-self-center rounded-lg text-[11px] font-semibold transition-transform active:scale-90 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-azul ${tone} ${
                future ? "opacity-40" : ""
              }`}
            >
              {Number(date.slice(-2))}
            </button>
          );
        })}
      </div>

      {editing && (
        <div className="flex flex-col gap-2 rounded-xl bg-fill p-3">
          <span className="text-[13px] font-semibold text-label">
            {longDate(editing)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => apply(editing, "success")}
              className="h-10 flex-1 rounded-lg bg-azul text-[14px] font-semibold text-azul-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Limpio
            </button>
            <button
              type="button"
              onClick={() => apply(editing, "relapse")}
              className="h-10 flex-1 rounded-lg bg-ambar text-[14px] font-semibold text-[#4A3A00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Recaída
            </button>
            <button
              type="button"
              onClick={() => apply(editing, null)}
              className="h-10 flex-1 rounded-lg bg-card text-[14px] font-semibold text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Borrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
