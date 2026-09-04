"use client";

import { CaretDown, Lightning } from "@phosphor-icons/react";
import { useState } from "react";
import { HabitIcon } from "@/components/habit-icon";
import { longDate } from "@/lib/dates";
import { MOOD_BY_KEY, TRIGGER_BY_KEY } from "@/lib/types";

export type HabitoDelDia = { id: string; name: string; icon: string };

export type ImpulsoDeBitacora = {
  hora: number;
  trigger: string | null;
  resistido: boolean;
  nota: string | null;
  habito: string | null;
};

export type DiaDeBitacora = {
  fecha: string;
  mood: string | null;
  nota: string | null;
  cumplidos: HabitoDelDia[];
  recaidas: HabitoDelDia[];
  impulsos: ImpulsoDeBitacora[];
};

/**
 * Un día del historial, que se abre.
 *
 * El historial enseñaba la cara, la fecha y la nota, y unos iconos verdes sin
 * explicar. Con eso, un día en que aguantaste tres impulsos y otro en que no
 * pasó nada se veían exactamente igual — y no son el mismo día ni de lejos. El
 * resumen de arriba dice qué pasó en números, y abriéndolo salen los nombres y
 * las horas.
 *
 * Cerrado por defecto: el historial se recorre de un vistazo y se abre lo que
 * llama la atención. Todo abierto sería una lista imposible de barrer.
 */
export function DiaDeBitacora({
  dia,
  esHoy,
}: {
  dia: DiaDeBitacora;
  esHoy: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  const mood = dia.mood ? MOOD_BY_KEY.get(dia.mood) : undefined;
  const aguantados = dia.impulsos.filter((i) => i.resistido).length;
  const hayDetalle =
    dia.cumplidos.length + dia.recaidas.length + dia.impulsos.length > 0;

  const resumen: string[] = [];
  if (dia.cumplidos.length > 0) {
    resumen.push(
      `${dia.cumplidos.length} ${dia.cumplidos.length === 1 ? "cumplido" : "cumplidos"}`,
    );
  }
  if (dia.recaidas.length > 0) {
    resumen.push(
      `${dia.recaidas.length} ${dia.recaidas.length === 1 ? "recaída" : "recaídas"}`,
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
          aria-label={mood?.label ?? "Sin ánimo"}
          className="shrink-0 text-[26px] leading-none"
        >
          {mood?.emoji ?? "•"}
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

          {dia.nota && (
            <p className="whitespace-pre-line text-pretty text-[15px] leading-[1.4] tracking-[-0.01em] text-label-2">
              {dia.nota}
            </p>
          )}
        </div>
      </div>

      {/* Sin nada que contar, la fila se queda como estaba: no tiene sentido un
          botón de "ver más" que abre un cajón vacío. */}
      {hayDetalle ? (
        <>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="flex items-center gap-1.5 px-4 pb-3.5 pt-2 text-left text-[12.5px] font-medium text-label-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-azul"
          >
            <span className="min-w-0 flex-1 truncate">
              {resumen.join(" · ")}
              {dia.impulsos.length > 0 && (
                <span className="text-menta">
                  {" "}
                  · {aguantados} aguantado{aguantados === 1 ? "" : "s"}
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
            <div className="flex flex-col gap-2.5 border-t border-separator px-4 py-3">
              {dia.cumplidos.length > 0 && (
                <Lista titulo="Cumplidos" habitos={dia.cumplidos} tono="text-menta" />
              )}
              {dia.recaidas.length > 0 && (
                <Lista titulo="Recaídas" habitos={dia.recaidas} tono="text-ambar" />
              )}

              {dia.impulsos.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-label-3">
                    Impulsos
                  </span>
                  <ul className="flex flex-col gap-1">
                    {dia.impulsos
                      .slice()
                      .sort((a, b) => a.hora - b.hora)
                      .map((im, n) => (
                        <li
                          key={`${im.hora}-${n}`}
                          className="flex items-center gap-2 text-[12.5px] text-label-2"
                        >
                          <Lightning
                            size={13}
                            weight="fill"
                            aria-hidden="true"
                            className="shrink-0 text-naranja"
                          />
                          <span className="tnum shrink-0">
                            {String(im.hora).padStart(2, "0")}:00
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {im.habito ? `${im.habito} · ` : ""}
                            {im.trigger
                              ? TRIGGER_BY_KEY.get(im.trigger)?.label
                              : "Sin disparador"}
                            {im.nota ? ` · ${im.nota}` : ""}
                          </span>
                          <span
                            className={`shrink-0 font-semibold ${im.resistido ? "text-menta" : "text-ambar"}`}
                          >
                            {im.resistido ? "Aguantado" : "Caí"}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="pb-3.5" />
      )}
    </li>
  );
}

function Lista({
  titulo,
  habitos,
  tono,
}: {
  titulo: string;
  habitos: HabitoDelDia[];
  tono: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-label-3">
        {titulo}
      </span>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {habitos.map((habit) => (
          <li
            key={habit.id}
            className={`flex items-center gap-1.5 text-[13px] ${tono}`}
          >
            <HabitIcon clave={habit.icon} size={15} />
            <span className="text-label">{habit.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
