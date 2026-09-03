"use client";

import { CheckCircle, LockSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { saveJournal } from "@/app/(app)/hoy/actions";
import { longDate } from "@/lib/dates";
import { MOODS } from "@/lib/types";

/**
 * Editor de la entrada del día. Aquí sí aparecen los doce estados de ánimo: en
 * la bitácora hay sitio para elegir con calma, a diferencia de la fila corta de
 * la pantalla Hoy.
 */
export function JournalEditor({
  date,
  initialMood,
  initialNote,
  pendientes,
}: {
  date: string;
  initialMood: string | null;
  initialNote: string | null;
  /**
   * Hábitos sin marcar hoy. Mientras quede alguno, el día no está cerrado y la
   * caja de escribir no se abre — la misma regla que en Hoy, y aquí también,
   * porque esta caja escribe la entrada del mismo día.
   */
  pendientes: number;
}) {
  const [mood, setMood] = useState(initialMood);
  const [note, setNote] = useState(initialNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Lo último que quedó guardado en el servidor. Se compara contra esto, no
  // contra las props: las props llegan del render anterior y no cambian al
  // guardar, así que el botón se quedaba en "Guardar" para siempre y parecía
  // que no se había enviado nada.
  const [guardado, setGuardado] = useState({
    mood: initialMood,
    note: initialNote ?? "",
  });

  const dirty = mood !== guardado.mood || note !== guardado.note;

  /** Quien todavía no tiene hábitos no puede cerrar nada: para esa persona
      la caja está abierta desde el primer día. */
  const cerrado = pendientes === 0;

  function save() {
    setError(null);
    startTransition(async () => {
      const limpia = note.trim() === "" ? null : note.trim();
      const result = await saveJournal(date, {
        mood: mood ?? undefined,
        note: limpia,
      });
      if (result.error) setError(result.error);
      else setGuardado({ mood, note: limpia ?? "" });
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-card p-4">
      {/* El encabezado dice de qué día es esta caja. Sin él, ver el propio texto
          ahí después de guardar parecía un borrador sin enviar y no lo que es:
          la entrada de hoy, que se puede seguir editando hasta medianoche. */}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[16px] font-semibold text-label">
          Tu entrada de hoy
        </h3>
        <span className="text-[12.5px] text-label-3">{longDate(date)}</span>
      </div>

      <div
        role="radiogroup"
        aria-label="Cómo te sentiste"
        className="grid grid-cols-6 gap-1.5"
      >
        {MOODS.map((option) => {
          const active = mood === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.label}
              onClick={() => setMood(option.key)}
              className={`pulsable flex h-11 items-center justify-center rounded-xl text-[24px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                active ? "bg-azul/15 ring-2 ring-azul ring-inset" : "bg-fill"
              }`}
            >
              <span aria-hidden="true">{option.emoji}</span>
            </button>
          );
        })}
      </div>

      <label className="sr-only" htmlFor="nota">
        Nota del día
      </label>
      <textarea
        id="nota"
        rows={4}
        maxLength={4000}
        value={note}
        disabled={!cerrado}
        onChange={(event) => setNote(event.target.value)}
        placeholder={
          cerrado
            ? "¿Qué pasó hoy? ¿Qué lo hizo fácil o difícil?"
            : "Marca tus hábitos en Hoy y se abre"
        }
        className="resize-none rounded-xl bg-fill p-3 text-[15px] leading-[1.45] text-label placeholder:text-label-3 disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
      />

      {!cerrado && (
        <p className="flex flex-wrap items-start gap-x-1.5 gap-y-0.5 text-[12.5px] leading-[1.35] text-label-2">
          <LockSimple
            size={14}
            weight="fill"
            aria-hidden="true"
            className="mt-px shrink-0"
          />
          Te {pendientes === 1 ? "falta" : "faltan"} {pendientes}{" "}
          {pendientes === 1 ? "hábito" : "hábitos"} por marcar.{" "}
          <Link
            href="/hoy"
            className="font-semibold text-azul focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            Ir a Hoy
          </Link>
        </p>
      )}

      {error && (
        <p role="alert" className="text-[13px] leading-[1.35] text-rojo">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span
          aria-live="polite"
          className="flex items-center gap-1.5 text-[13px] font-medium text-menta"
        >
          {!dirty && guardado.mood && (
            <>
              <CheckCircle size={16} weight="fill" aria-hidden="true" />
              Guardada. La puedes editar hasta medianoche.
            </>
          )}
        </span>
        {/* El botón solo existe cuando hay algo sin guardar. Antes se quedaba
            ahí apagado diciendo "Guardado" al lado de otro "Guardado", y dos
            avisos de lo mismo se leen como que algo falló. */}
        {(dirty || pending) && (
          <button
            type="button"
            onClick={save}
            disabled={pending || !mood}
            className="pulsable h-11 shrink-0 rounded-xl bg-azul px-5 text-[15px] font-semibold text-azul-tinta disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            {pending ? "Guardando…" : guardado.mood ? "Guardar cambios" : "Guardar"}
          </button>
        )}
      </div>
    </div>
  );
}
