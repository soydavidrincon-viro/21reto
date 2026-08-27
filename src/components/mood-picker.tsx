"use client";

import { useOptimistic, useTransition } from "react";
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
}: {
  today: string;
  selected: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(selected);

  function pick(key: string) {
    startTransition(async () => {
      setOptimistic(key);
      await saveJournal(today, { mood: key });
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Cómo te sentiste hoy"
      className="flex gap-1.5 rounded-2xl bg-card px-2.5 py-3"
    >
      {EN_HOY.map((clave) => MOOD_BY_KEY.get(clave)!).map((mood) => {
        const active = optimistic === mood.key;

        return (
          <button
            key={mood.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={mood.label}
            disabled={pending}
            onClick={() => pick(mood.key)}
            className={`flex h-[46px] w-full items-center justify-center rounded-xl text-[26px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
              active ? "bg-azul/15 ring-2 ring-azul ring-inset" : ""
            }`}
          >
            <span aria-hidden="true">{mood.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
