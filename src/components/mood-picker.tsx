"use client";

import { CheckCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { saveJournal } from "@/app/(app)/hoy/actions";
import { MOOD_BY_KEY } from "@/lib/types";

/**
 * Reacción del día. Caben seis, y esos seis van repartidos por todo el rango.
 *
 * Antes eran los seis primeros de la lista, que están ordenados de mejor a
 * peor: quedaban genial, orgulloso, bien, en calma, neutral y cansado. Alguien
 * que abría la app en un mal día no tenía ni una cara con la que decirlo, y ese
 * es justo el día que hay que poder registrar. Los doce siguen en la bitácora.
 */
const EN_HOY = ["genial", "bien", "neutral", "bajo", "ansioso", "molesto"];

export function MoodPicker({
  today,
  selected,
  nota,
}: {
  today: string;
  selected: string | null;
  nota: string | null;
}) {
  const [mood, setMood] = useState(selected);
  const [note, setNote] = useState(nota ?? "");
  const [guardado, setGuardado] = useState({
    mood: selected,
    note: nota ?? "",
  });
  const [pending, startTransition] = useTransition();

  const sucio = mood !== guardado.mood || note !== guardado.note;

  /**
   * La cara y la nota son la misma entrada del día, así que van en la misma
   * llamada. Con dos guardados por separado, escribir la nota después de elegir
   * la cara pisaba una de las dos según cuál llegara última.
   */
  function guardar(siguienteMood: string | null, siguienteNota: string) {
    startTransition(async () => {
      const limpia = siguienteNota.trim() === "" ? null : siguienteNota.trim();
      await saveJournal(today, {
        mood: siguienteMood ?? undefined,
        note: limpia,
      });
      setGuardado({ mood: siguienteMood, note: limpia ?? "" });
    });
  }

  function elegir(clave: string) {
    setMood(clave);
    // Tocar una cara guarda al instante: es la interacción de un solo toque y
    // obligar a confirmarla la volvería un formulario.
    guardar(clave, note);
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[22px] bg-card p-3">
      <div
        role="radiogroup"
        aria-label="Cómo te sentiste hoy"
        className="grid grid-cols-6 gap-1.5"
      >
        {EN_HOY.map((clave) => MOOD_BY_KEY.get(clave)!).map((option) => {
          const active = mood === option.key;

          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.label}
              disabled={pending}
              onClick={() => elegir(option.key)}
              className={`pulsable flex h-[46px] items-center justify-center rounded-xl text-[26px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                active ? "bg-azul/15 ring-2 ring-azul ring-inset" : ""
              }`}
            >
              <span aria-hidden="true">{option.emoji}</span>
            </button>
          );
        })}
      </div>

      <label className="sr-only" htmlFor="nota-hoy">
        Nota de hoy
      </label>
      <textarea
        id="nota-hoy"
        rows={2}
        maxLength={4000}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="¿Qué pasó hoy? (opcional)"
        className="resize-none rounded-xl bg-fill p-3 text-[15px] leading-[1.45] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
      />

      <div className="flex items-center justify-between gap-2">
        {sucio || pending ? (
          <>
            <span className="text-[12.5px] text-label-3">
              {mood ? "" : "Elige una cara para guardar"}
            </span>
            <button
              type="button"
              onClick={() => guardar(mood, note)}
              disabled={pending || !mood}
              className="pulsable h-10 shrink-0 rounded-xl bg-azul px-4 text-[14px] font-semibold text-azul-tinta disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </>
        ) : (
          <>
            <span
              aria-live="polite"
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-menta"
            >
              {guardado.mood && (
                <>
                  <CheckCircle size={15} weight="fill" aria-hidden="true" />
                  Guardado
                </>
              )}
            </span>
            <Link
              href="/bitacora"
              className="shrink-0 text-[12.5px] font-semibold text-azul focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Ver la bitácora
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
