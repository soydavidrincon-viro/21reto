"use client";

import { useOptimistic, useTransition } from "react";
import { saveMood } from "@/app/(app)/hoy/actions";
import { MOODS } from "@/lib/types";

/**
 * Reacción del día. Se muestran los seis estados más frecuentes; el resto vive
 * en la bitácora, donde hay sitio para elegir con calma.
 */
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
      await saveMood(today, key);
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Cómo te sentiste hoy"
      className="flex gap-1.5 rounded-2xl bg-card px-2.5 py-3"
    >
      {MOODS.slice(0, 6).map((mood) => {
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
            className={`flex h-[46px] w-full items-center justify-center rounded-xl text-[26px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${
              active ? "bg-blue/15 ring-2 ring-blue ring-inset" : ""
            }`}
          >
            <span aria-hidden="true">{mood.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
