"use client";

import { CheckCircle, PencilSimple } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { saveJournal } from "@/app/(app)/hoy/actions";
import { longDate } from "@/lib/dates";
import { MOOD_BY_KEY, MOODS } from "@/lib/types";

/**
 * Editor de la entrada del día. Aquí sí aparecen los doce estados de ánimo: en
 * la bitácora hay sitio para elegir con calma, a diferencia de la fila corta de
 * la pantalla Hoy.
 *
 * Al guardar, el formulario se cierra y deja ver la entrada como texto. Antes
 * se quedaba con el textarea lleno de lo escrito, y eso se lee como un borrador
 * a medio enviar: no hay diferencia visible entre "lo escribí" y "quedó
 * guardado". La entrada se sigue pudiendo editar hasta medianoche, pero eso es
 * un botón, no el estado por defecto.
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

  // Abierto si todavía no hay nada guardado; si ya lo hay, hasta que se toque
  // "Editar".
  const [editando, setEditando] = useState(!initialMood);

  const dirty = mood !== guardado.mood || note !== guardado.note;

  function save() {
    setError(null);
    startTransition(async () => {
      const limpia = note.trim() === "" ? null : note.trim();
      const result = await saveJournal(date, {
        mood: mood ?? undefined,
        note: limpia,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setGuardado({ mood, note: limpia ?? "" });
      setEditando(false);
    });
  }

  const caraGuardada = guardado.mood ? MOOD_BY_KEY.get(guardado.mood) : undefined;

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

      {!editando && caraGuardada ? (
        <>
          <div className="flex items-start gap-3">
            <span
              aria-label={caraGuardada.label}
              className="shrink-0 text-[30px] leading-none"
            >
              {caraGuardada.emoji}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-label">
                Te sentiste {caraGuardada.label.toLowerCase()}
              </span>
              {guardado.note ? (
                <p className="whitespace-pre-line text-pretty text-[15px] leading-[1.45] text-label-2">
                  {guardado.note}
                </p>
              ) : (
                <span className="text-[13.5px] text-label-3">
                  Sin nota. Puedes añadir una.
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span
              aria-live="polite"
              className="flex items-center gap-1.5 text-[13px] font-medium text-menta"
            >
              <CheckCircle size={16} weight="fill" aria-hidden="true" />
              Guardada
            </span>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="pulsable flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-fill px-3.5 text-[14px] font-semibold text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              <PencilSimple size={15} weight="bold" aria-hidden="true" />
              Editar
            </button>
          </div>
        </>
      ) : (
        <>
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
            <p role="alert" className="text-[13px] leading-[1.35] text-rojo">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-label-3">
              {mood ? "" : "Elige una cara para guardar"}
            </span>
            <div className="flex shrink-0 gap-2">
              {/* Cancelar solo cuando hay algo guardado a lo que volver. */}
              {caraGuardada && (
                <button
                  type="button"
                  onClick={() => {
                    setMood(guardado.mood);
                    setNote(guardado.note);
                    setEditando(false);
                    setError(null);
                  }}
                  className="pulsable h-11 rounded-xl bg-fill px-4 text-[15px] font-semibold text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={save}
                disabled={pending || !mood || (!dirty && !!caraGuardada)}
                className="pulsable h-11 rounded-xl bg-azul px-5 text-[15px] font-semibold text-azul-tinta disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
              >
                {pending ? "Guardando…" : caraGuardada ? "Guardar cambios" : "Guardar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
