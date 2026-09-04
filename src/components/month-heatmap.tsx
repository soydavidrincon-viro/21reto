"use client";

import { CaretLeft, CaretRight, Lightning } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { clearDay, markDay } from "@/app/(app)/hoy/actions";
import { longDate, monthGrid, monthName } from "@/lib/dates";
import { DOW_INICIALES, TRIGGER_BY_KEY, type LogStatus } from "@/lib/types";

export type ImpulsoDelDia = {
  local_date: string;
  local_hour: number;
  intensity: number;
  trigger_key: string | null;
  resisted: boolean;
  note: string | null;
};

/** Lunes primero, domingo al final: como se lee una semana en español. */
const SEMANA = [1, 2, 3, 4, 5, 6, 0];

/**
 * El calendario del hábito: se navega por meses y se puede entrar en un día.
 *
 * Antes solo enseñaba el mes en curso, y eso deja fuera media racha cada vez
 * que se cruza un día 1: quien lleva cuarenta días no podía ver dónde empezaron.
 * Ahora se puede ir atrás hasta el mes en que arrancó el reto —más atrás no hay
 * nada que ver— y adelante hasta el mes de hoy.
 *
 * Y al tocar un día ya no salen solo los botones de corregir: sale lo que pasó
 * ese día. Un calendario en el que un cuadro azul no se puede abrir es un
 * gráfico, no un diario.
 *
 * El mes se calcula en el cliente porque los registros ya vienen todos: el
 * detalle del hábito los pide sin filtro de fecha, así que cambiar de mes no
 * cuesta una consulta.
 */
export function MonthHeatmap({
  habitId,
  kind,
  today,
  startDate,
  initial,
  notas,
  impulsos,
}: {
  habitId: string;
  /** Lo que se deja tiene recaídas; lo que se construye, días saltados. */
  kind: "quit" | "build";
  today: string;
  /** El día en que arrancó el reto: el tope de hasta dónde se puede ir atrás. */
  startDate: string;
  initial: Record<string, LogStatus>;
  /** La nota que se guardó con el día, si la hubo. */
  notas: Record<string, string>;
  impulsos: ImpulsoDelDia[];
}) {
  /**
   * Lo que diga el servidor manda.
   *
   * Lo local son solo los cambios que aún no han vuelto del servidor, encima
   * de lo que llegó por props. Antes se copiaba `initial` a un estado al
   * montar y ahí se quedaba: cuando la acción revalidaba la página y llegaban
   * registros nuevos —la recaída escrita desde el botón de emergencia, por
   * ejemplo— el calendario seguía enseñando su copia vieja hasta recargar.
   */
  const [pendientes, setPendientes] = useState<Record<string, LogStatus | null>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [mes, setMes] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const status: Record<string, LogStatus> = { ...initial };
  for (const [fecha, estado] of Object.entries(pendientes)) {
    if (estado === null) delete status[fecha];
    else status[fecha] = estado;
  }

  const recaida = kind === "build" ? "Saltado" : "Recaída";
  const days = monthGrid(mes);

  // Se compara por año-mes, no por fecha completa: el día 20 de septiembre es
  // "el mes de hoy" aunque hoy sea 4.
  const aMes = (iso: string) => iso.slice(0, 7);
  const hayAnterior = aMes(mes) > aMes(startDate);
  const haySiguiente = aMes(mes) < aMes(today);

  function moverMes(delta: number) {
    // Al día 1 y luego ±1 mes: sumar treinta días se salta febrero y repite
    // meses de 31.
    const [y, m] = mes.split("-").map(Number);
    const siguiente = new Date(y, m - 1 + delta, 1);
    const iso = `${siguiente.getFullYear()}-${String(siguiente.getMonth() + 1).padStart(2, "0")}-01`;
    setMes(iso);
    setEditing(null);
  }

  /**
   * Se pinta primero y se guarda después. Si el guardado falla, se vuelve a lo
   * que había y se dice por qué: antes el resultado se tiraba y un día que no
   * llegó a escribirse se quedaba azul en pantalla hasta la siguiente carga.
   */
  function apply(date: string, next: LogStatus | null) {
    setError(null);
    setPendientes((current) => ({ ...current, [date]: next }));

    startTransition(async () => {
      const result =
        next === null
          ? await clearDay(habitId, date)
          : await markDay(habitId, date, next);
      if (result.error) setError(result.error);
      // Con éxito, la página ya se revalidó y `initial` trae el cambio; con
      // error, lo que había en `initial` sigue siendo la verdad. En los dos
      // casos el parche local sobra.
      setPendientes((current) => {
        const copy = { ...current };
        delete copy[date];
        return copy;
      });
    });
  }

  const delDia = editing
    ? impulsos.filter((i) => i.local_date === editing)
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!hayAnterior}
          onClick={() => moverMes(-1)}
          aria-label="Mes anterior"
          className="pulsable flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          <CaretLeft size={16} weight="bold" aria-hidden="true" />
        </button>
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-label">
          {monthName(mes)}
          {/* El año solo cuando no es el de hoy: ponerlo siempre es ruido once
              meses de cada doce, y no ponerlo nunca hace que enero de dos años
              distintos se vea igual. */}
          {mes.slice(0, 4) !== today.slice(0, 4) && (
            <span className="tnum ml-1.5 font-normal text-label-3">
              {mes.slice(0, 4)}
            </span>
          )}
        </h3>
        <button
          type="button"
          disabled={!haySiguiente}
          onClick={() => moverMes(1)}
          aria-label="Mes siguiente"
          className="pulsable flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          <CaretRight size={16} weight="bold" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5" aria-hidden="true">
        {SEMANA.map((dow) => (
          <span
            key={dow}
            className="mx-auto w-full max-w-[42px] text-center text-[10.5px] font-semibold text-label-2"
          >
            {DOW_INICIALES[dow]}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((date, i) => {
          if (!date) return <span key={`hueco-${i}`} aria-hidden="true" />;

          const state = status[date];
          const isToday = date === today;
          const future = date > today;
          const abierto = editing === date;
          const tuvoImpulsos = impulsos.some((im) => im.local_date === date);

          const tone =
            state === "success"
              ? "bg-azul text-azul-tinta"
              : state === "relapse"
                ? "bg-ambar text-ambar-tinta"
                : isToday
                  ? "bg-card text-azul ring-2 ring-azul ring-inset"
                  : "bg-fill text-label-3";

          return (
            <button
              key={date}
              type="button"
              disabled={future || pending}
              onClick={() => setEditing(abierto ? null : date)}
              aria-label={`${longDate(date)}: ${
                state === "success"
                  ? "limpio"
                  : state === "relapse"
                    ? recaida.toLowerCase()
                    : future
                      ? "por venir"
                      : "sin registro"
              }${tuvoImpulsos ? ", con impulsos registrados" : ""}`}
              className={`tnum relative flex aspect-square w-full max-w-[42px] items-center justify-center justify-self-center rounded-lg text-[11px] font-semibold transition-transform active:scale-90 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-azul ${tone} ${
                future ? "opacity-40" : ""
              } ${abierto ? "ring-2 ring-label ring-offset-1 ring-offset-card" : ""}`}
            >
              {Number(date.slice(-2))}
              {/* Un punto naranja marca los días en que hubo impulsos. Es el
                  dato que el calendario no contaba: dos meses iguales de azul
                  pueden haber costado cosas muy distintas. */}
              {tuvoImpulsos && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-[3px] size-[3px] rounded-full bg-naranja"
                />
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-[13px] leading-[1.35] text-rojo">
          {error}
        </p>
      )}

      {editing && (
        <div className="flex flex-col gap-2.5 rounded-xl bg-fill p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-label">
              {longDate(editing)}
            </span>
            <span className="text-[12px] text-label-2">
              {status[editing] === "success"
                ? "Limpio"
                : status[editing] === "relapse"
                  ? recaida
                  : "Sin registro"}
            </span>
          </div>

          {notas[editing] && (
            <p className="whitespace-pre-line text-pretty text-[13.5px] leading-[1.45] text-label-2">
              {notas[editing]}
            </p>
          )}

          {delDia.length > 0 && (
            <ul className="flex flex-col gap-1">
              {delDia
                .slice()
                .sort((a, b) => a.local_hour - b.local_hour)
                .map((im, n) => (
                  <li
                    key={`${im.local_hour}-${n}`}
                    className="flex items-center gap-2 text-[12.5px] text-label-2"
                  >
                    <Lightning
                      size={13}
                      weight="fill"
                      aria-hidden="true"
                      className="shrink-0 text-naranja"
                    />
                    <span className="tnum shrink-0">
                      {String(im.local_hour).padStart(2, "0")}:00
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {im.trigger_key
                        ? TRIGGER_BY_KEY.get(im.trigger_key)?.label
                        : "Sin disparador"}
                      {im.note ? ` · ${im.note}` : ""}
                    </span>
                    <span
                      className={`shrink-0 font-semibold ${im.resisted ? "text-menta" : "text-ambar"}`}
                    >
                      {im.resisted ? "Aguantado" : "Caí"}
                    </span>
                  </li>
                ))}
            </ul>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => apply(editing, "success")}
              className="h-11 flex-1 rounded-lg bg-azul text-[14px] font-semibold text-azul-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Limpio
            </button>
            <button
              type="button"
              onClick={() => apply(editing, "relapse")}
              className="h-11 flex-1 rounded-lg bg-ambar text-[14px] font-semibold text-ambar-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              {recaida}
            </button>
            <button
              type="button"
              onClick={() => apply(editing, null)}
              className="h-11 flex-1 rounded-lg bg-card text-[14px] font-semibold text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Borrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
