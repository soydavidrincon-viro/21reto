"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { saveJournal } from "@/app/(app)/hoy/actions";
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
}: {
  date: string;
  initialMood: string | null;
  initialNote: string | null;
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
        onChange={(event) => setNote(event.target.value)}
        placeholder="¿Qué pasó hoy? ¿Qué lo hizo fácil o difícil?"
        className="resize-none rounded-xl bg-fill p-3 text-[15px] leading-[1.45] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
      />

      {error && (
        <p role="alert" className="text-[13px] leading-[1.35] text-red-500">
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
              Guardado
            </>
          )}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty || !mood}
          className="pulsable h-11 rounded-xl bg-azul px-5 text-[15px] font-semibold text-azul-tinta disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          {pending ? "Guardando…" : dirty ? "Guardar" : "Guardado"}
        </button>
      </div>
    </div>
  );
}
