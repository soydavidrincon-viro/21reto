"use client";

import { HandPalm, Lightning, X } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { logCraving } from "@/app/actions/cravings";
import { CRAVING_TRIGGERS, type DailyOverviewRow } from "@/lib/types";

/**
 * "Me está dando".
 *
 * Se toca en el momento, no al final del día, así que todo aquí está pensado
 * para alguien que tiene treinta segundos de paciencia: intensidad, disparador
 * y salida. La nota es opcional y va al final; obligar a escribir convertiría
 * el botón de emergencia en un formulario, y el formulario no se llena.
 *
 * Aguantar sale en verde y grande. Es el resultado que la app quiere y es más
 * trabajo que marcar un día. Caer sale al lado, del mismo tamaño y sin drama:
 * si registrar una caída se siente como confesar, nadie la registra, y entonces
 * los datos solo describen los días buenos.
 */
export function CravingSheet({
  habits,
  onClose,
}: {
  habits: DailyOverviewRow[];
  onClose: () => void;
}) {
  const [habitId, setHabitId] = useState<string | null>(
    habits.length === 1 ? habits[0].habit_id : null,
  );
  const [intensity, setIntensity] = useState(3);
  const [triggerKey, setTriggerKey] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar(resisted: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await logCraving({
        habitId,
        intensity,
        triggerKey,
        note: note || null,
        resisted,
      });
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar un antojo"
        className="entrar relative flex max-h-[92dvh] w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card p-5 sm:rounded-[28px]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-[22px] font-semibold leading-none tracking-[-0.01em] text-label">
              Te está dando
            </h2>
            <p className="text-[13.5px] leading-[1.4] text-label-2">
              Registrarlo ya es hacer algo. Toma treinta segundos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="pulsable -mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            <X size={17} weight="bold" aria-hidden="true" />
          </button>
        </div>

        {habits.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3">
              ¿De cuál?
            </span>
            <div className="flex flex-wrap gap-1.5">
              {habits.map((habit) => (
                <button
                  key={habit.habit_id}
                  type="button"
                  aria-pressed={habitId === habit.habit_id}
                  onClick={() =>
                    setHabitId(habitId === habit.habit_id ? null : habit.habit_id)
                  }
                  className={`min-h-10 rounded-[20px] px-3.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                    habitId === habit.habit_id
                      ? "bg-azul text-azul-tinta"
                      : "bg-fill text-label"
                  }`}
                >
                  {habit.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3">
              Qué tan fuerte
            </span>
            <span className="text-[13px] font-semibold text-label-2">
              {["Apenas", "Suave", "Normal", "Fuerte", "Durísimo"][intensity - 1]}
            </span>
          </div>
          <div
            role="radiogroup"
            aria-label="Intensidad del antojo"
            className="flex gap-1.5"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={intensity === n}
                aria-label={`Intensidad ${n} de 5`}
                onClick={() => setIntensity(n)}
                className={`pulsable flex h-12 flex-1 items-center justify-center gap-0.5 rounded-xl text-[15px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                  intensity >= n
                    ? "bg-naranja text-naranja-tinta"
                    : "bg-fill text-label-3"
                }`}
              >
                <Lightning
                  size={16}
                  weight={intensity >= n ? "fill" : "regular"}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3">
            ¿Qué lo disparó?
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CRAVING_TRIGGERS.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={triggerKey === t.key}
                onClick={() => setTriggerKey(triggerKey === t.key ? null : t.key)}
                className={`min-h-10 rounded-[20px] px-3.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                  triggerKey === t.key
                    ? "bg-lila text-lila-tinta"
                    : "bg-fill text-label"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={2}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Qué estaba pasando (opcional)"
          aria-label="Nota del antojo"
          className="resize-none rounded-xl bg-fill p-3 text-[15px] leading-[1.45] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        />

        {error && (
          <p role="alert" className="text-[13px] leading-[1.35] text-rojo">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => guardar(true)}
            className="pulsable flex h-[56px] flex-[1.6] items-center justify-center gap-2 rounded-[16px] bg-menta text-[16px] font-semibold tracking-[-0.01em] text-menta-tinta disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            <HandPalm size={19} weight="fill" aria-hidden="true" />
            {pending ? "Guardando…" : "Lo aguanté"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => guardar(false)}
            className="pulsable flex h-[56px] flex-1 items-center justify-center rounded-[16px] bg-ambar text-[16px] font-semibold tracking-[-0.01em] text-ambar-tinta disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            Caí
          </button>
        </div>
      </div>
    </div>
  );
}
