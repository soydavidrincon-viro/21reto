"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useState } from "react";
import {
  DetalleDeDia,
  type DiaDeBitacora as Dia,
  type HabitoDelDia,
  type ImpulsoDeBitacora,
} from "@/components/detalle-de-dia";
import { HabitIcon } from "@/components/habit-icon";
import { longDate } from "@/lib/dates";
import { MOOD_BY_KEY } from "@/lib/types";

// Los tipos viven con el detalle; aquí se reexportan para que la página siga
// importando todo de un sitio. Tipo y componente comparten nombre a propósito.
export type DiaDeBitacora = Dia;
export type { HabitoDelDia, ImpulsoDeBitacora };

/**
 * Un día del historial, que se abre y se puede escribir.
 *
 * El resumen de arriba dice qué pasó en números, y abriéndolo sale el detalle
 * con los nombres, las horas y el botón de escribir. Cerrado por defecto: el
 * historial se recorre de un vistazo y se abre lo que llama la atención.
 *
 * El detalle es el mismo que abre el calendario de abajo (`DetalleDeDia`);
 * aquí solo va la cabecera y el desplegable.
 */
export function DiaDeBitacora({
  dia,
  esHoy,
  bloqueado = 0,
}: {
  dia: Dia;
  esHoy: boolean;
  /** Solo para hoy: cuántos hábitos faltan por marcar. Con alguno, candado. */
  bloqueado?: number;
}) {
  const [abierto, setAbierto] = useState(false);

  // Copia local de lo guardado, para que la fila cambie en el acto y no
  // después de que vuelva el servidor.
  const [guardado, setGuardado] = useState({
    mood: dia.mood,
    nota: dia.nota,
  });

  const cara = guardado.mood ? MOOD_BY_KEY.get(guardado.mood) : undefined;
  const aguantados = dia.impulsos.filter((i) => i.resistido).length;
  const hayDetalle =
    dia.cumplidos.length + dia.recaidas.length + dia.impulsos.length > 0;

  const soloSaltados =
    dia.recaidas.length > 0 && dia.recaidas.every((h) => h.kind === "build");

  const resumen: string[] = [];
  if (dia.cumplidos.length > 0) {
    resumen.push(
      `${dia.cumplidos.length} ${dia.cumplidos.length === 1 ? "cumplido" : "cumplidos"}`,
    );
  }
  if (dia.recaidas.length > 0) {
    const n = dia.recaidas.length;
    resumen.push(
      soloSaltados
        ? `${n} ${n === 1 ? "saltado" : "saltados"}`
        : `${n} ${n === 1 ? "recaída" : "recaídas"}`,
    );
  }
  if (dia.impulsos.length > 0) {
    resumen.push(
      `${dia.impulsos.length} ${dia.impulsos.length === 1 ? "impulso" : "impulsos"}`,
    );
  }

  return (
    <li className="flex flex-col rounded-2xl bg-card">
      <div className="flex gap-3 px-4 pt-3.5">
        <span
          aria-label={cara?.label ?? "Sin ánimo"}
          className="shrink-0 text-[26px] leading-none"
        >
          {cara?.emoji ?? "•"}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-baseline gap-2">
              {esHoy && (
                <span className="rounded-md bg-azul px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-azul-tinta">
                  Hoy
                </span>
              )}
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-label">
                {longDate(dia.fecha)}
              </span>
            </span>
            {dia.cumplidos.length > 0 && (
              <span
                aria-hidden="true"
                className="flex shrink-0 items-center gap-1 text-menta"
              >
                {dia.cumplidos.slice(0, 4).map((habit) => (
                  <HabitIcon key={habit.id} clave={habit.icon} size={16} />
                ))}
              </span>
            )}
          </div>

          {guardado.nota && (
            <p className="whitespace-pre-line text-pretty text-[15px] leading-[1.4] tracking-[-0.01em] text-label-2">
              {guardado.nota}
            </p>
          )}
        </div>
      </div>

      {/* El desplegable va siempre, aunque no haya nada que resumir: es también
          la puerta a escribir ese día, y esconderla en los días vacíos dejaría
          fuera justo los que hay que rellenar. */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex items-center gap-1.5 px-4 pb-3.5 pt-2 text-left text-[12.5px] font-medium text-label-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-azul"
      >
        <span className="min-w-0 flex-1 truncate">
          {hayDetalle ? (
            <>
              {resumen.join(" · ")}
              {dia.impulsos.length > 0 && (
                <span className="text-menta">
                  {" "}
                  · {aguantados} aguantado{aguantados === 1 ? "" : "s"}
                </span>
              )}
            </>
          ) : (
            <span className="text-label-3">
              {cara ? "Ver y editar" : "Sin nada registrado"}
            </span>
          )}
        </span>
        <CaretDown
          size={14}
          weight="bold"
          aria-hidden="true"
          className={`shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <div className="border-t border-separator px-4 py-3">
          <DetalleDeDia
            dia={dia}
            bloqueado={esHoy ? bloqueado : 0}
            onGuardado={(mood, nota) => setGuardado({ mood, nota })}
          />
        </div>
      )}
    </li>
  );
}
