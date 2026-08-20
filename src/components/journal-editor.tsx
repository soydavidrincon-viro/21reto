"use client";

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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = mood !== initialMood || note !== (initialNote ?? "");

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveJournal(date, {
        mood: mood ?? undefined,
        note: note.trim() === "" ? null : note.trim(),
      });
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4">
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
              onClick={() => {
                setMood(option.key);
                setSaved(false);
              }}
              className={`flex h-11 items-center justify-center rounded-xl text-[24px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${
                active ? "bg-blue/15 ring-2 ring-blue ring-inset" : "bg-fill"
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
        onChange={(event) => {
          setNote(event.target.value);
          setSaved(false);
        }}
        placeholder="¿Qué pasó hoy? ¿Qué lo hizo fácil o difícil?"
        className="resize-none rounded-xl bg-fill p-3 text-[15px] leading-[1.45] tracking-[-0.01em] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
      />

      {error && (
        <p role="alert" className="text-[13px] leading-[1.35] text-red">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span aria-live="polite" className="text-[13px] text-label-2">
          {saved && !dirty ? "Guardado" : ""}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty || !mood}
          className="h-11 rounded-xl bg-blue px-5 text-[15px] font-semibold text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
