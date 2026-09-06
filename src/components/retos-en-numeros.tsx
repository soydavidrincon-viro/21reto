import Link from "next/link";
import { HabitIcon } from "@/components/habit-icon";
import { faltaPara } from "@/lib/milestones";
import { HABIT_SKIN, type DailyOverviewRow } from "@/lib/types";

/**
 * Lo principal de Progreso: un bloque por reto con los días que lleva.
 *
 * Antes lo primero que se veía era "Total acumulado", que suma días de retos
 * distintos y no le dice a nadie cómo va el suyo. Esto pone cada reto con su
 * color, su icono y su racha en grande, como en Hoy pero de un vistazo y
 * todos a la vez. Con uno solo ocupa el ancho entero; con dos o más, a dos
 * columnas.
 *
 * El número es la racha actual, no el total: "cuántos días llevas" es la
 * pregunta que se hace cualquiera al abrir Progreso, y el total ya sale
 * debajo en una línea.
 */
export function RetosEnNumeros({ habits }: { habits: DailyOverviewRow[] }) {
  if (habits.length === 0) return null;

  return (
    <ul
      className={`mx-4 grid gap-3 lg:mx-0 ${habits.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
    >
      {habits.map((habit, i) => {
        const skin = HABIT_SKIN[habit.color];
        const falta = faltaPara(habit.current_streak, habit.target_days);
        const cumplido = habit.clean_days >= habit.target_days;
        const unico = habits.length === 1;

        return (
          <li
            key={habit.habit_id}
            className="entrar"
            style={{ animationDelay: `${0.06 + i * 0.04}s` }}
          >
            <Link
              href={`/habito/${habit.habit_id}`}
              aria-label={`${habit.name}: racha de ${habit.current_streak} ${habit.current_streak === 1 ? "día" : "días"}`}
              className={`pulsable flex h-full flex-col justify-between gap-4 rounded-[24px] p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                unico ? "min-h-[150px] lg:p-6" : "min-h-[160px]"
              }`}
              style={{ background: skin.fondo, color: skin.tinta }}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(255,255,255,0.28)" }}
                >
                  <HabitIcon clave={habit.icon} size={20} weight="fill" />
                </span>
                <span className="text-right text-[11px] font-bold uppercase tracking-[0.08em] opacity-70">
                  {cumplido
                    ? "Meta cumplida"
                    : habit.kind === "build"
                      ? "Empezando"
                      : "Dejando"}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span
                  className={`tnum font-display font-bold leading-none tracking-[-0.03em] ${
                    unico ? "text-[56px]" : "text-[44px]"
                  }`}
                >
                  {habit.current_streak}
                </span>
                <span className="text-[13px] font-semibold opacity-80">
                  {habit.current_streak === 1 ? "día seguido" : "días seguidos"}
                  {" · "}
                  <span className="tnum">meta {habit.target_days}</span>
                </span>
                <span className="mt-1 truncate font-display text-[16px] font-semibold leading-tight tracking-[-0.01em]">
                  {habit.name}
                </span>
                <span className="text-[12.5px] leading-[1.35] opacity-75">
                  {habit.pendientes.length > 0
                    ? `${habit.pendientes.length} ${habit.pendientes.length === 1 ? "día" : "días"} sin contestar`
                    : cumplido
                      ? `${habit.clean_days} días en total`
                      : habit.current_streak === 0
                        ? "Hoy puede ser el día uno"
                        : (falta?.texto ?? `${habit.clean_days} días en total`)}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
