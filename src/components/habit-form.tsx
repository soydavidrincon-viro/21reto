"use client";

import { Check } from "@phosphor-icons/react";
import { HabitIcon } from "@/components/habit-icon";
import { COMPANIONS, Companion, type CompanionKey } from "@/components/companion";
import { useState, useTransition } from "react";
import { createHabit } from "@/app/actions/habits";
import { detectTimeZone } from "@/lib/dates";
import type { HabitColor } from "@/lib/types";

/**
 * Los sospechosos habituales, con color e icono ya elegidos.
 *
 * `icon` guarda una clave y no un emoji: los emoji se ven distintos en cada
 * sistema, y el hábito de alguien no debería cambiar de cara según el teléfono
 * con que abra la app.
 */
const PRESETS: { name: string; icon: string; color: HabitColor }[] = [
  { name: "Alcohol", icon: "alcohol", color: "blue" },
  { name: "Nicotina", icon: "nicotina", color: "orange" },
  { name: "Azúcar", icon: "azucar", color: "pink" },
  { name: "Redes sociales", icon: "redes", color: "purple" },
  { name: "Apuestas", icon: "apuestas", color: "green" },
  { name: "Cafeína", icon: "cafeina", color: "yellow" },
  { name: "Compras", icon: "compras", color: "pink" },
  { name: "Videojuegos", icon: "videojuegos", color: "purple" },
];

const DURATIONS = [21, 30, 60, 90];

export function HabitForm({ finishOnboarding = false }: { finishOnboarding?: boolean }) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number] | null>(null);
  const [custom, setCustom] = useState("");
  const [targetDays, setTargetDays] = useState(21);
  const [policy, setPolicy] = useState<"reset" | "continue">("continue");
  const [companion, setCompanion] = useState<CompanionKey>("brote");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const name = preset?.name ?? custom;
  const ready = name.trim().length > 0;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createHabit({
        name,
        icon: preset?.icon ?? "otro",
        color: preset?.color ?? "blue",
        targetDays,
        relapsePolicy: policy,
        finishOnboarding,
        timezone: detectTimeZone(),
        companion: finishOnboarding ? companion : undefined,
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
              // El peso de la fuente no cambia al seleccionar: si el chip
              // elegido se pone en negrita se ensancha y toda la fila se
              // reacomoda, saltando de tres columnas a dos.
              className={`inline-flex min-h-11 items-center gap-[7px] rounded-[22px] px-4 text-[15px] font-medium tracking-[-0.01em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                active ? "bg-azul text-azul-tinta" : "bg-card text-label"
              }`}
            >
              <HabitIcon clave={option.icon} size={18} weight={active ? "fill" : "regular"} />
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
          className="mx-4 h-[50px] rounded-2xl bg-card px-4 text-[17px] tracking-[-0.02em] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
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
                className={`tnum flex h-[38px] w-full items-center justify-center rounded-[7px] text-[14px] font-medium tracking-[-0.01em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                  active
                    ? "bg-segment text-label shadow-sm"
                    : "text-label-2"
                }`}
              >
                {days === 21 ? "21 días" : days}
              </button>
            );
          })}
        </div>
      </div>

      {finishOnboarding && (
        <div className="flex flex-col gap-[7px]">
          <span className="px-8 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
            ¿Quién te acompaña?
          </span>
          <div
            role="radiogroup"
            aria-label="Compañero"
            className="mx-4 grid grid-cols-4 gap-2"
          >
            {(Object.keys(COMPANIONS) as CompanionKey[]).map((clave) => {
              const elegido = companion === clave;
              return (
                <button
                  key={clave}
                  type="button"
                  role="radio"
                  aria-checked={elegido}
                  onClick={() => setCompanion(clave)}
                  className={`pulsable flex flex-col items-center gap-1 rounded-[18px] px-1 pb-2.5 pt-3 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                    elegido ? "ring-2 ring-label" : "opacity-70"
                  }`}
                  style={{ background: COMPANIONS[clave].fondo }}
                >
                  <Companion
                    who={clave}
                    size={54}
                    sombra={false}
                    className={elegido ? "flota" : ""}
                    mood={elegido ? "contento" : "normal"}
                  />
                  <span
                    className="font-display text-[13px] font-semibold"
                    style={{ color: COMPANIONS[clave].tinta }}
                  >
                    {COMPANIONS[clave].nombre}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="px-8 text-[12.5px] leading-[1.4] text-label-2">
            {COMPANIONS[companion].frase}
          </p>
        </div>
      )}

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
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-azul"
              >
                <span className="flex flex-1 flex-col gap-px">
                  <span className="text-[17px] font-medium tracking-[-0.02em] text-label">
                    {title}
                  </span>
                  <span className="text-[13px] tracking-[-0.01em] text-label-2">{detail}</span>
                </span>
                {policy === value && (
                  <Check size={22} weight="bold" className="text-azul" aria-hidden="true" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 px-5 pt-4">
        {error && (
          <p role="alert" className="text-center text-[13px] leading-[1.35] text-rojo">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!ready || pending}
          className="pulsable flex h-[54px] items-center justify-center rounded-[16px] bg-azul text-[17px] font-semibold tracking-[-0.02em] text-azul-tinta shadow-[0_8px_24px_-8px_var(--c-azul)] disabled:opacity-40 disabled:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          {pending ? "Creando…" : "Empezar mi reto"}
        </button>
      </div>
    </div>
  );
}
