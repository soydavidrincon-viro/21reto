"use client";

import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { useState } from "react";
import {
  DetalleDeDia,
  diaVacio,
  type DiaDeBitacora,
} from "@/components/detalle-de-dia";
import { Portal, useHojaModal } from "@/components/portal";
import { longDate, monthGrid, monthName } from "@/lib/dates";
import { DOW_INICIALES, MOOD_BY_KEY } from "@/lib/types";

/** Lunes primero, domingo al final: como se lee una semana en español. */
const SEMANA = [1, 2, 3, 4, 5, 6, 0];

/**
 * Todos los días de la bitácora, por meses.
 *
 * El historial en lista servía para los últimos días y para nada más: quien
 * lleva noventa días y quiere leer el primero tenía que pasar noventa
 * tarjetas. Aquí cada día es una casilla —con su cara si la escribió, con un
 * punto si solo marcó— y al tocarlo se abre una hoja con lo que pasó ese día,
 * que se puede escribir o corregir ahí mismo.
 *
 * Se va atrás hasta el mes más viejo con algo dentro y adelante hasta el mes
 * de hoy. Los días de después de hoy salen apagados: no hay nada que escribir
 * de un día que no ha llegado, y `saveJournal` tampoco lo dejaría.
 *
 * Hoy respeta el candado: mientras falte algo por marcar se lee, no se escribe.
 */
export function CalendarioDeBitacora({
  dias,
  today,
  faltan,
}: {
  dias: DiaDeBitacora[];
  today: string;
  /** Hábitos de hoy sin marcar. Con alguno, hoy sale con candado. */
  faltan: number;
}) {
  const [mes, setMes] = useState(today);
  const [abierto, setAbierto] = useState<string | null>(null);

  // Lo guardado desde la hoja, encima de lo que llegó del servidor, para que
  // la casilla cambie de cara en el acto.
  const [cambios, setCambios] = useState<
    Record<string, { mood: string; nota: string | null }>
  >({});

  const porFecha = new Map(dias.map((d) => [d.fecha, d]));
  const aMes = (iso: string) => iso.slice(0, 7);

  // El mes más viejo con algo: hasta ahí se puede ir atrás. Sin nada, hoy.
  const masViejo = dias.reduce(
    (min, d) => (d.fecha < min ? d.fecha : min),
    today,
  );
  const hayAnterior = aMes(mes) > aMes(masViejo);
  const haySiguiente = aMes(mes) < aMes(today);

  function moverMes(delta: number) {
    // Al día 1 y luego ±1 mes: sumar treinta días se salta febrero.
    const [y, m] = mes.split("-").map(Number);
    const siguiente = new Date(y, m - 1 + delta, 1);
    setMes(
      `${siguiente.getFullYear()}-${String(siguiente.getMonth() + 1).padStart(2, "0")}-01`,
    );
  }

  function diaDe(fecha: string): DiaDeBitacora {
    const base = porFecha.get(fecha) ?? diaVacio(fecha);
    const cambio = cambios[fecha];
    return cambio ? { ...base, mood: cambio.mood, nota: cambio.nota } : base;
  }

  const days = monthGrid(mes);

  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-card p-4">
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
            className="mx-auto w-full max-w-[44px] text-center text-[10.5px] font-semibold text-label-2"
          >
            {DOW_INICIALES[dow]}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((fecha, i) => {
          if (!fecha) return <span key={`hueco-${i}`} aria-hidden="true" />;

          const dia = diaDe(fecha);
          const cara = dia.mood ? MOOD_BY_KEY.get(dia.mood) : undefined;
          const conMarcas =
            dia.cumplidos.length + dia.recaidas.length + dia.impulsos.length > 0;
          const futuro = fecha > today;
          const esHoy = fecha === today;

          return (
            <button
              key={fecha}
              type="button"
              disabled={futuro}
              onClick={() => setAbierto(fecha)}
              aria-label={`${longDate(fecha)}: ${
                cara
                  ? `te sentiste ${cara.label.toLowerCase()}`
                  : conMarcas
                    ? "con registros, sin escribir"
                    : futuro
                      ? "por venir"
                      : "sin nada escrito"
              }`}
              className={`relative flex aspect-square w-full max-w-[44px] flex-col items-center justify-center justify-self-center rounded-xl transition-transform active:scale-90 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-azul ${
                cara
                  ? "bg-fill"
                  : esHoy
                    ? "bg-card ring-2 ring-azul ring-inset"
                    : "bg-fill"
              } ${futuro ? "opacity-35" : ""}`}
            >
              {cara ? (
                <span aria-hidden="true" className="text-[20px] leading-none">
                  {cara.emoji}
                </span>
              ) : (
                <span
                  className={`tnum text-[12px] font-semibold ${esHoy ? "text-azul" : "text-label-2"}`}
                >
                  {Number(fecha.slice(-2))}
                </span>
              )}
              {/* Un punto azul en los días con marcas pero sin cara: hubo día,
                  falta contarlo. */}
              {!cara && conMarcas && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-[4px] size-[4px] rounded-full bg-azul"
                />
              )}
            </button>
          );
        })}
      </div>

      {abierto && (
        <HojaDeDia
          dia={diaDe(abierto)}
          bloqueado={abierto === today ? faltan : 0}
          esHoy={abierto === today}
          cerrar={() => setAbierto(null)}
          onGuardado={(mood, nota) =>
            setCambios((c) => ({ ...c, [abierto]: { mood, nota } }))
          }
        />
      )}
    </div>
  );
}

function HojaDeDia({
  dia,
  bloqueado,
  esHoy,
  cerrar,
  onGuardado,
}: {
  dia: DiaDeBitacora;
  bloqueado: number;
  esHoy: boolean;
  cerrar: () => void;
  onGuardado: (mood: string, nota: string | null) => void;
}) {
  const hoja = useHojaModal(cerrar);
  const cara = dia.mood ? MOOD_BY_KEY.get(dia.mood) : undefined;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
        <div
          aria-hidden="true"
          onClick={cerrar}
          className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        />

        <div
          ref={hoja}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={longDate(dia.fecha)}
          className="entrar relative flex max-h-[92dvh] w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card p-5 outline-none sm:rounded-[28px]"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-label={cara?.label ?? "Sin ánimo"}
                className="shrink-0 text-[34px] leading-none"
              >
                {cara?.emoji ?? "•"}
              </span>
              <div className="flex flex-col gap-0.5">
                <h2 className="flex items-center gap-2 font-display text-[20px] font-semibold leading-none tracking-[-0.01em] text-label">
                  {esHoy && (
                    <span className="rounded-md bg-azul px-1.5 py-0.5 font-ui text-[10.5px] font-bold uppercase tracking-[0.06em] text-azul-tinta">
                      Hoy
                    </span>
                  )}
                  {longDate(dia.fecha)}
                </h2>
                <p className="text-[13.5px] leading-[1.4] text-label-2">
                  {cara
                    ? `Te sentiste ${cara.label.toLowerCase()}`
                    : "Sin nada escrito todavía"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="pulsable -mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              <X size={17} weight="bold" aria-hidden="true" />
            </button>
          </div>

          {dia.nota && (
            <p className="whitespace-pre-line text-pretty text-[15px] leading-[1.45] text-label-2">
              {dia.nota}
            </p>
          )}

          {/* La hoja se pinta de nuevo por fecha: al cambiar de día el detalle
              arranca limpio, sin arrastrar el borrador del anterior. */}
          <DetalleDeDia
            key={dia.fecha}
            dia={dia}
            bloqueado={bloqueado}
            onGuardado={onGuardado}
          />
        </div>
      </div>
    </Portal>
  );
}
