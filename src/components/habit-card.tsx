"use client";

import { ArrowCounterClockwise, CaretRight, Check } from "@phosphor-icons/react";
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
  const [deshaciendo, setDeshaciendo] = useState(false);

  const done = habit.today_status === "success";
  const relapsed = habit.today_status === "relapse";
  const skin = HABIT_SKIN[habit.color];
  const progreso = Math.min(100, (habit.clean_days / habit.target_days) * 100);

  /**
   * Marcar es de un toque; desmarcar, de dos.
   *
   * Antes el mismo botón hacía las dos cosas, así que volver a tocarlo por
   * costumbre —o para comprobar que sí había quedado— borraba el día sin decir
   * nada. Perder un día marcado por un toque de más es exactamente el tipo de
   * cosa que hace que alguien deje de usar la app.
   */
  function alTocar() {
    if (done && !deshaciendo) {
      setDeshaciendo(true);
      setTimeout(() => setDeshaciendo(false), 4000);
      return;
    }

    startTransition(async () => {
      if (done) {
        await clearDay(habit.habit_id, today);
        setDeshaciendo(false);
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
                  ? habit.kind === "build"
                    ? "Hoy quedó saltado"
                    : "Recaída registrada hoy"
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
          onClick={alTocar}
          disabled={pending}
          aria-label={
            deshaciendo
              ? `Confirmar que quieres quitar ${habit.name} de hoy`
              : done
                ? `${habit.name} está marcado hoy. Tocar para quitarlo.`
                : `Marcar ${habit.name} de hoy`
          }
          className={`pulsable flex w-[76px] shrink-0 flex-col items-center justify-center gap-1 rounded-[22px] transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
            deshaciendo
              ? "bg-ambar text-ambar-tinta"
              : done
                ? "bg-menta text-menta-tinta"
                : "bg-card text-label-3"
          }`}
        >
          {deshaciendo ? (
            <ArrowCounterClockwise size={22} weight="bold" aria-hidden="true" />
          ) : (
            <Check size={done ? 26 : 22} weight="bold" aria-hidden="true" />
          )}
          <span className="text-center text-[10.5px] font-bold uppercase leading-[1.1] tracking-[0.04em]">
            {deshaciendo ? "¿Quitar?" : done ? "Hecho" : "Marcar"}
          </span>
        </button>
      </div>
    </>
  );
}
