"use client";

import { CaretRight, X } from "@phosphor-icons/react";
import Link from "next/link";
import { createContext, useContext, useState } from "react";
import {
  Companion,
  type CompanionEtapa,
  type CompanionKey,
} from "@/components/companion";
import { HabitCard } from "@/components/habit-card";
import { MoodPicker } from "@/components/mood-picker";
import { MOOD_BY_KEY, type DailyOverviewRow } from "@/lib/types";

/**
 * El cierre del día: marcar los hábitos y contar cómo fue.
 *
 * La cara y la nota vivían además en un formulario siempre abierto al pie de
 * Hoy. Con la hoja ya hecha, eso eran dos sitios para lo mismo en la misma
 * pantalla: el formulario pidiendo la cara antes de haber marcado nada, y la
 * hoja pidiéndola otra vez al terminar. Queda solo la hoja, que es el momento
 * en que la pregunta tiene sentido — acabas de cerrar el día, cuéntalo mientras
 * lo tienes fresco.
 *
 * Lo que queda en la pantalla es una línea, y solo cuando hace falta: si el día
 * está cerrado y todavía no has dicho nada, para poder volver si cerraste la
 * hoja o si marcaste desde el detalle de un hábito, donde la hoja no salta.
 * Ese hueco era real: sin esa línea, cerrar la hoja dejaba Hoy sin ninguna
 * puerta a la bitácora del día.
 *
 * El estado vive en un contexto porque las dos piezas caen en columnas
 * distintas en escritorio —los hábitos a la izquierda, el ánimo a la derecha— y
 * pasarlo por props obligaría a envolver media pantalla en un componente de
 * cliente.
 */

type Cierre = {
  today: string;
  moodDeHoy: string | null;
  abrir: () => void;
  /** Lo llama la lista al marcar: decide si ese fue el último del día. */
  alMarcar: (habitId: string, habits: DailyOverviewRow[]) => void;
};

const Ctx = createContext<Cierre | null>(null);

export function CierreDelDiaProvider({
  today,
  moodDeHoy,
  notaDeHoy,
  companion,
  etapa,
  children,
}: {
  today: string;
  moodDeHoy: string | null;
  notaDeHoy: string | null;
  companion: CompanionKey;
  etapa: CompanionEtapa;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  /**
   * Se decide con la foto de antes del toque: si ningún OTRO hábito quedaba
   * pendiente, el que se acaba de marcar era el último. Contarlo así en vez de
   * esperar a que vuelvan los datos del servidor hace que no dependa de cuándo
   * termine de recargarse la pantalla.
   *
   * Los días que no tocan no cuentan como pendientes: un hábito de martes y
   * jueves no puede impedir que el domingo se dé por cerrado.
   */
  function alMarcar(habitId: string, habits: DailyOverviewRow[]) {
    if (moodDeHoy) return;
    const quedaban = habits.filter(
      (h) => h.habit_id !== habitId && h.toca_hoy && h.today_status === null,
    ).length;
    if (quedaban === 0) setAbierto(true);
  }

  return (
    <Ctx.Provider
      value={{ today, moodDeHoy, abrir: () => setAbierto(true), alMarcar }}
    >
      {children}

      {abierto && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setAbierto(false)}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cerrar el día"
            className="entrar relative flex max-h-[92dvh] w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card p-5 sm:rounded-[28px]"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Companion
                  who={companion}
                  size={56}
                  mood="celebra"
                  etapa={etapa}
                  sombra={false}
                  className="salta shrink-0"
                />
                <div className="flex flex-col gap-0.5">
                  <h2 className="font-display text-[22px] font-semibold leading-none tracking-[-0.01em] text-label">
                    Día cerrado
                  </h2>
                  <p className="text-[13.5px] leading-[1.4] text-label-2">
                    Ya marcaste todo. ¿Cómo te fue?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="pulsable -mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
              >
                <X size={17} weight="bold" aria-hidden="true" />
              </button>
            </div>

            <MoodPicker
              today={today}
              selected={moodDeHoy}
              nota={notaDeHoy}
              enlaceABitacora={false}
              onGuardado={() => setAbierto(false)}
            />

            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="pulsable h-11 rounded-[14px] bg-fill text-[15px] font-semibold text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Ahora no
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Los hábitos de hoy. Avisan al contexto cuando se marca el último. */
export function HabitosDeHoy({ habits }: { habits: DailyOverviewRow[] }) {
  const cierre = useContext(Ctx);

  return (
    <>
      {habits.map((habit, i) => (
        <HabitCard
          key={habit.habit_id}
          habit={habit}
          today={cierre?.today ?? ""}
          delay={0.18 + i * 0.06}
          onMarcado={() => cierre?.alMarcar(habit.habit_id, habits)}
        />
      ))}
    </>
  );
}

/**
 * La única huella del ánimo en la pantalla de Hoy.
 *
 * Tres estados, y en dos de ellos no ocupa nada:
 * - el día sin cerrar: nada. Todavía no hay nada que contar.
 * - cerrado y sin contar: una línea para abrir la hoja.
 * - ya contado: la cara guardada, que es acuse de recibo, no un formulario.
 */
export function AnimoDeHoy({ pendientes }: { pendientes: number }) {
  const cierre = useContext(Ctx);
  if (!cierre) return null;

  const guardado = cierre.moodDeHoy
    ? MOOD_BY_KEY.get(cierre.moodDeHoy)
    : undefined;

  if (guardado) {
    return (
      <Link
        href="/bitacora"
        className="pulsable entrar mx-4 flex items-center gap-3 rounded-[22px] bg-card px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul lg:mx-0"
        style={{ animationDelay: "0.16s" }}
      >
        <span aria-hidden="true" className="text-[26px] leading-none">
          {guardado.emoji}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-label">
            Hoy te sentiste {guardado.label.toLowerCase()}
          </span>
          <span className="text-[12.5px] text-label-2">Ver la bitácora</span>
        </span>
        <CaretRight
          size={16}
          weight="bold"
          className="shrink-0 text-label-3"
          aria-hidden="true"
        />
      </Link>
    );
  }

  if (pendientes > 0) return null;

  return (
    <button
      type="button"
      onClick={cierre.abrir}
      className="pulsable entrar mx-4 flex items-center gap-3 rounded-[22px] bg-card px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul lg:mx-0"
      style={{ animationDelay: "0.16s" }}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-label">
          Te falta contar cómo te fue
        </span>
        <span className="text-[12.5px] text-label-2">
          Ya cerraste el día. Una cara y, si quieres, dos líneas.
        </span>
      </span>
      <CaretRight
        size={16}
        weight="bold"
        className="shrink-0 text-label-3"
        aria-hidden="true"
      />
    </button>
  );
}
