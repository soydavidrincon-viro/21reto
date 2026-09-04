"use client";

import { CheckCircle, PencilSimple } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { setHabitMotivo } from "@/app/actions/habits";
import { MAX_MOTIVO } from "@/lib/types";

/**
 * El "por qué" del hábito, editable desde su detalle.
 *
 * Es el dato más barato de pedir y el más caro de no tener: es lo que la app
 * enseña en el botón de emergencia y después de una caída, que son los dos
 * momentos en que una frase propia pesa más que cualquier cosa que la app
 * pueda decir. Quien no lo escribió al crear el hábito lo puede poner aquí.
 */
export function MotivoDelHabito({
  habitId,
  inicial,
  kind,
}: {
  habitId: string;
  inicial: string | null;
  kind: "quit" | "build";
}) {
  const [guardado, setGuardado] = useState(inicial ?? "");
  const [texto, setTexto] = useState(inicial ?? "");
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setError(null);
    startTransition(async () => {
      const limpio = texto.trim();
      const r = await setHabitMotivo(habitId, limpio || null);
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
          {kind === "build" ? "Para qué lo haces" : "Para qué lo dejas"}
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
          <label className="sr-only" htmlFor={`motivo-${habitId}`}>
            Para qué
          </label>
          <textarea
            id={`motivo-${habitId}`}
            rows={2}
            maxLength={MAX_MOTIVO}
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Una frase tuya. Se te enseña cuando más falta hace."
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
      ) : guardado ? (
        <p className="text-pretty font-display text-[17px] font-medium leading-[1.4] text-label">
          “{guardado}”
        </p>
      ) : (
        <p className="text-pretty text-[13.5px] leading-[1.45] text-label-2">
          Todavía no lo escribiste. Una frase tuya aparece en el botón de
          emergencia y después de una caída, justo cuando hace falta.
        </p>
      )}

      {!editando && guardado && (
        <span className="flex items-center gap-1.5 text-[12px] text-label-3">
          <CheckCircle size={14} weight="fill" aria-hidden="true" />
          Se te enseña en el botón de emergencia y tras una caída
        </span>
      )}
    </section>
  );
}
