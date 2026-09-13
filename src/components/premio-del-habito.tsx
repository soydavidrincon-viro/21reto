"use client";

import { Gift, Lock, PencilSimple } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { setHabitPremio } from "@/app/actions/habits";
import { MAX_PREMIO } from "@/lib/types";

/**
 * El premio del reto, editable desde su detalle.
 *
 * Es lo que la persona se da si cumple: una cena, un fin de semana, lo que
 * sea. Mientras el reto va, se enseña bajo llave: el texto borroso y un
 * candado con el día en que se abre. Al llegar a la meta se abre con "Te lo
 * ganaste". Si el reto vuelve a cero, se vuelve a cerrar solo: abierto o
 * cerrado lo decide comparar días con meta, no una columna.
 *
 * Lo escribió la persona, así que borroso no es secreto: es la señal de que
 * todavía no toca. Editar sigue a mano; es suyo.
 */
export function PremioDelHabito({
  habitId,
  inicial,
  dias,
  meta,
}: {
  habitId: string;
  inicial: string | null;
  /** Días del reto en curso. */
  dias: number;
  /** La meta en días. */
  meta: number;
}) {
  const [guardado, setGuardado] = useState(inicial ?? "");
  const [texto, setTexto] = useState(inicial ?? "");
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const abierto = dias >= meta;

  function guardar() {
    setError(null);
    startTransition(async () => {
      const limpio = texto.trim();
      const r = await setHabitPremio(habitId, limpio || null);
      if (r.error) {
        setError(r.error);
        return;
      }
      setGuardado(limpio);
      setTexto(limpio);
      setEditando(false);
    });
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-[22px] bg-card px-4 py-4 lg:px-5 lg:py-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-label">
          Tu premio
        </h2>
        {!editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="pulsable flex h-9 items-center gap-1.5 rounded-xl bg-fill px-3 text-[13px] font-semibold text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            <PencilSimple size={14} weight="bold" aria-hidden="true" />
            {guardado ? "Editar" : "Escribir"}
          </button>
        )}
      </div>

      {editando ? (
        <>
          <label className="sr-only" htmlFor={`premio-${habitId}`}>
            Tu premio
          </label>
          <textarea
            id={`premio-${habitId}`}
            rows={2}
            maxLength={MAX_PREMIO}
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Una cena en ese restaurante, un fin de semana fuera…"
            className="resize-none rounded-xl bg-fill p-3 text-[15px] leading-[1.45] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          />
          {error && (
            <p role="alert" className="text-[13px] leading-[1.35] text-rojo">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setTexto(guardado);
                setEditando(false);
                setError(null);
              }}
              className="pulsable h-10 rounded-xl bg-fill px-3.5 text-[14px] font-semibold text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={pending || texto.trim() === guardado}
              className="pulsable h-10 rounded-xl bg-azul px-4 text-[14px] font-semibold text-azul-tinta disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </>
      ) : !guardado ? (
        <p className="text-pretty text-[13.5px] leading-[1.45] text-label-2">
          Todavía no lo pusiste. Algo que te vas a dar si llegas al día {meta}.
          Queda bajo llave hasta entonces.
        </p>
      ) : abierto ? (
        <div className="flex items-start gap-3 rounded-[16px] bg-menta/20 px-3.5 py-3">
          <Gift size={22} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0 text-menta-tinta" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-label">Te lo ganaste.</span>
            <p className="text-pretty font-display text-[17px] font-medium leading-[1.4] text-label">
              “{guardado}”
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p
            aria-hidden="true"
            className="pointer-events-none select-none text-pretty font-display text-[17px] font-medium leading-[1.4] text-label blur-sm"
          >
            “{guardado}”
          </p>
          <span className="flex items-center gap-1.5 text-[12.5px] text-label-2">
            <Lock size={14} weight="fill" aria-hidden="true" />
            <span className="tnum">
              Se abre el día {meta}. {dias === 0 ? "Hoy puede ser el uno." : `Llevas ${dias}.`}
            </span>
          </span>
        </div>
      )}
    </section>
  );
}
