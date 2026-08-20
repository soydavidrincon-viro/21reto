"use client";

import Link from "next/link";
import { useTransition } from "react";
import { clearDay, markDay } from "@/app/(app)/hoy/actions";
import type { DailyOverviewRow } from "@/lib/types";

/**
 * Fila de hábito de la lista agrupada. El botón de la derecha alterna el día:
 * tocarlo lo marca limpio, volver a tocarlo deshace la marca. La recaída se
 * registra desde el detalle, no desde aquí — es una acción que merece contexto.
 */
export function HabitRow({
  habit,
  today,
  last,
}: {
  habit: DailyOverviewRow;
  today: string;
  last: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const done = habit.today_status === "success";
  const relapsed = habit.today_status === "relapse";

  function toggle() {
    startTransition(async () => {
      if (done) await clearDay(habit.habit_id, today);
      else await markDay(habit.habit_id, today, "success");
    });
  }

  return (
    <>
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <Link
          href={`/habito/${habit.habit_id}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[17px]"
            style={{ background: `var(--c-${habit.color}, var(--c-blue))` }}
          >
            {habit.icon}
          </span>
          <span className="flex min-w-0 flex-col gap-px">
            <span className="truncate text-[17px] font-medium tracking-[-0.02em] text-label">
              {habit.name}
            </span>
            <span className="text-[13px] tracking-[-0.01em] text-label-2">
              {relapsed
                ? "Recaída registrada hoy"
                : habit.current_streak === 0
                  ? "Sin racha todavía"
                  : `Racha de ${habit.current_streak} ${habit.current_streak === 1 ? "día" : "días"}`}
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={done}
          aria-label={done ? `Deshacer ${habit.name} de hoy` : `Marcar ${habit.name} como limpio hoy`}
          className="shrink-0 rounded-full transition-opacity disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
        >
          <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
            {done ? (
              <>
                <circle cx="15" cy="15" r="14" className="fill-green" />
                <path
                  d="m9 15.4 4 4 8-8.4"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            ) : (
              <circle
                cx="15"
                cy="15"
                r="13.5"
                fill="none"
                className="stroke-separator"
                strokeWidth="1.6"
              />
            )}
          </svg>
        </button>
      </div>

      {!last && <div className="ml-[58px] h-px bg-separator" />}
    </>
  );
}
