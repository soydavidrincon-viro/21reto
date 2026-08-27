"use client";

import { Check } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { createHabit } from "@/app/actions/habits";
import { detectTimeZone } from "@/lib/dates";
import type { HabitColor } from "@/lib/types";

/** Los sospechosos habituales, con el color e icono ya elegidos. */
const PRESETS: { name: string; icon: string; color: HabitColor }[] = [
  { name: "Alcohol", icon: "🍺", color: "blue" },
  { name: "Nicotina", icon: "🚬", color: "orange" },
  { name: "Azúcar", icon: "🍩", color: "pink" },
  { name: "Redes sociales", icon: "📱", color: "purple" },
  { name: "Apuestas", icon: "🎰", color: "green" },
  { name: "Cafeína", icon: "☕️", color: "yellow" },
  { name: "Compras", icon: "🛍️", color: "pink" },
  { name: "Porno", icon: "🔞", color: "blue" },
];

const DURATIONS = [21, 30, 60, 90];

export function HabitForm({ finishOnboarding = false }: { finishOnboarding?: boolean }) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number] | null>(null);
  const [custom, setCustom] = useState("");
  const [targetDays, setTargetDays] = useState(21);
  const [policy, setPolicy] = useState<"reset" | "continue">("continue");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const name = preset?.name ?? custom;
  const ready = name.trim().length > 0;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createHabit({
        name,
        icon: preset?.icon ?? "🎯",
        color: preset?.color ?? "blue",
        targetDays,
        relapsePolicy: policy,
        finishOnboarding,
        timezone: detectTimeZone(),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap gap-2.5 px-5">
        {PRESETS.map((option) => {
          const active = preset?.name === option.name;
          return (
            <button
              key={option.name}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setPreset(active ? null : option);
                setCustom("");
              }}
              className={`inline-flex min-h-11 items-center gap-[7px] rounded-[22px] px-4 text-[15px] tracking-[-0.01em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${
                active
                  ? "bg-blue font-semibold text-white"
                  : "bg-card font-medium text-label"
              }`}
            >
              <span aria-hidden="true" className="text-[17px]">
                {option.icon}
              </span>
              {option.name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-[7px]">
        <label
          htmlFor="custom"
          className="px-8 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2"
        >
          O escríbelo tú
        </label>
        <input
          id="custom"
          value={custom}
          onChange={(event) => {
            setCustom(event.target.value);
            setPreset(null);
          }}
          maxLength={80}
          placeholder="Lo que quieres dejar"
          className="mx-4 h-[50px] rounded-2xl bg-card px-4 text-[17px] tracking-[-0.02em] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
        />
      </div>

      <div className="flex flex-col gap-[7px]">
        <span className="px-8 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
          Duración del reto
        </span>
        <div
          role="radiogroup"
          aria-label="Duración del reto"
          className="mx-4 flex gap-0.5 rounded-[9px] bg-fill p-0.5"
        >
          {DURATIONS.map((days) => {
            const active = targetDays === days;
            return (
              <button
                key={days}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTargetDays(days)}
                className={`tnum flex h-[38px] w-full items-center justify-center rounded-[7px] text-[14px] tracking-[-0.01em] text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${
                  active ? "bg-card font-semibold shadow-sm" : "font-medium"
                }`}
              >
                {days === 21 ? "21 días" : days}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-[7px]">
        <span className="px-8 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
          Si tengo una recaída
        </span>
        <div className="mx-4 overflow-hidden rounded-2xl bg-card">
          {(
            [
              ["continue", "Sigo contando", "El reto continúa y la recaída queda registrada"],
              ["reset", "Vuelvo a empezar de cero", "La racha se reinicia ese día"],
            ] as const
          ).map(([value, title, detail], i) => (
            <div key={value}>
              {i > 0 && <div className="ml-3.5 h-px bg-separator" />}
              <button
                type="button"
                role="radio"
                aria-checked={policy === value}
                onClick={() => setPolicy(value)}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue"
              >
                <span className="flex flex-1 flex-col gap-px">
                  <span className="text-[17px] font-medium tracking-[-0.02em] text-label">
                    {title}
                  </span>
                  <span className="text-[13px] tracking-[-0.01em] text-label-2">{detail}</span>
                </span>
                {policy === value && (
                  <Check size={22} weight="bold" className="text-blue" aria-hidden="true" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 px-5 pt-4">
        {error && (
          <p role="alert" className="text-center text-[13px] leading-[1.35] text-red">
            {error}
          </p>
        )}
        <p className="text-pretty text-center text-[12px] leading-[1.35] text-label-2">
          Antídoto acompaña tu proceso. No sustituye atención profesional.
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={!ready || pending}
          className="flex h-[50px] items-center justify-center rounded-[14px] bg-blue text-[17px] font-semibold tracking-[-0.02em] text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
        >
          {pending ? "Creando…" : "Empezar mi reto"}
        </button>
      </div>
    </div>
  );
}
