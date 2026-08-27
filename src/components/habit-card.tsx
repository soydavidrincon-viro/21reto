"use client";

import { CaretRight, Check } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { clearDay, markDay } from "@/app/(app)/hoy/actions";
import { HabitIcon } from "@/components/habit-icon";
import { MilestoneCelebration } from "@/components/milestone-celebration";
import { milestoneReached } from "@/lib/milestones";
import { HABIT_SKIN, type DailyOverviewRow } from "@/lib/types";

/**
 * Tarjeta de hábito.
 *
 * Rellena de color, no gris con un borde: es la diferencia entre una lista de
 * ajustes y algo que da ganas de tocar. El check ocupa un tercio de la tarjeta
 * porque es la única acción que la persona hace todos los días.
 */
export function HabitCard({
  habit,
  today,
  delay = 0,
}: {
  habit: DailyOverviewRow;
  today: string;
  delay?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [celebrating, setCelebrating] = useState<number | null>(null);

  const done = habit.today_status === "success";
  const relapsed = habit.today_status === "relapse";
  const skin = HABIT_SKIN[habit.color];
  const progreso = Math.min(100, (habit.clean_days / habit.target_days) * 100);

  function toggle() {
    startTransition(async () => {
      if (done) {
        await clearDay(habit.habit_id, today);
        return;
      }
      const result = await markDay(habit.habit_id, today, "success");
      if (result.streak !== null) setCelebrating(milestoneReached(result.streak));
    });
  }

  return (
    <>
      <MilestoneCelebration day={celebrating} onDone={() => setCelebrating(null)} />

      <div
        className="entrar flex items-stretch gap-2.5"
        style={{ animationDelay: `${delay}s` }}
      >
        <Link
          href={`/habito/${habit.habit_id}`}
          className="pulsable flex min-w-0 flex-1 flex-col gap-2.5 rounded-[22px] px-4 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          style={{ background: skin.fondo }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(255,255,255,0.22)", color: skin.tinta }}
            >
              <HabitIcon clave={habit.icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block truncate font-display text-[17px] font-semibold tracking-[-0.01em]"
                style={{ color: skin.tinta }}
              >
                {habit.name}
              </span>
              <span
                className="tnum block text-[12.5px] font-medium opacity-70"
                style={{ color: skin.tinta }}
              >
                {relapsed
                  ? "Recaída registrada hoy"
                  : habit.current_streak === 0
                    ? "Sin racha todavía"
                    : `Racha de ${habit.current_streak} ${habit.current_streak === 1 ? "día" : "días"}`}
              </span>
            </span>
            <CaretRight
              size={16}
              weight="bold"
              className="shrink-0 opacity-45"
              style={{ color: skin.tinta }}
              aria-hidden="true"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <span
              className="h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ background: "rgba(0,0,0,0.16)" }}
            >
              <span
                className="block h-full rounded-full"
                style={{ width: `${progreso}%`, background: skin.tinta, opacity: 0.85 }}
              />
            </span>
            <span
              className="tnum shrink-0 text-[12px] font-bold opacity-75"
              style={{ color: skin.tinta }}
            >
              {habit.clean_days}/{habit.target_days}
            </span>
          </div>
        </Link>

        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={done}
          aria-label={
            done ? `Deshacer ${habit.name} de hoy` : `Marcar ${habit.name} como limpio hoy`
          }
          className={`pulsable flex w-[76px] shrink-0 flex-col items-center justify-center gap-1 rounded-[22px] transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
            done ? "bg-menta text-menta-tinta" : "bg-card text-label-3"
          }`}
        >
          <Check size={done ? 26 : 22} weight="bold" aria-hidden="true" />
          <span className="text-[11px] font-bold uppercase tracking-[0.05em]">
            {done ? "Hecho" : "Marcar"}
          </span>
        </button>
      </div>
    </>
  );
}
