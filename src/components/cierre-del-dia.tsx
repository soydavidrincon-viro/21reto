"use client";

import { X } from "@phosphor-icons/react";
import { useState } from "react";
import {
  Companion,
  type CompanionEtapa,
  type CompanionKey,
} from "@/components/companion";
import { HabitCard } from "@/components/habit-card";
import { MoodPicker } from "@/components/mood-picker";
import type { DailyOverviewRow } from "@/lib/types";

/**
 * La lista de hábitos de Hoy, más la hoja que sale al terminar de marcarlos.
 *
 * La idea es que la bitácora se llene, y esto es la segunda forma de intentarlo.
 * La primera fue bloquear la caja de escribir hasta cerrar el día, y estaba mal:
 * un candado convierte en obligación algo que la app quiere que apetezca, y
 * castiga —con una pantalla apagada— justo a quien todavía no ha hecho nada
 * malo. Esto lo hace al revés. Cuando marcas el último hábito del día, sale
 * sola: has terminado, cuéntalo mientras lo tienes fresco.
 *
 * Solo aparece cuando el último que quedaba pasa a marcado, y solo si ese día
 * todavía no habías puesto la cara. Si ya la habías puesto no hay nada que
 * pedir; y si la cierras, no vuelve a salir, porque no salta al navegar sino al
 * marcar, y ese momento ya pasó.
 */
export function CierreDelDia({
  habits,
  today,
  moodDeHoy,
  notaDeHoy,
  companion,
  etapa,
}: {
  habits: DailyOverviewRow[];
  today: string;
  moodDeHoy: string | null;
  notaDeHoy: string | null;
  companion: CompanionKey;
  etapa: CompanionEtapa;
}) {
  const [abierto, setAbierto] = useState(false);

  /**
   * Se decide en el momento del toque y con la foto de antes de marcar: si
   * ningún OTRO hábito quedaba pendiente, el que se acaba de marcar era el
   * último. Contarlo así en vez de esperar a que vuelvan los datos del servidor
   * hace que no dependa de cuándo termine de recargarse la pantalla.
   *
   * Los días que no tocan no cuentan como pendientes. Un hábito de martes y
   * jueves no puede impedir que el domingo se dé por cerrado.
   */
  function alMarcar(habitId: string) {
    if (moodDeHoy) return;
    const quedaban = habits.filter(
      (h) =>
        h.habit_id !== habitId && h.toca_hoy && h.today_status === null,
    ).length;
    if (quedaban === 0) setAbierto(true);
  }

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {habits.map((habit, i) => (
          <HabitCard
            key={habit.habit_id}
            habit={habit}
            today={today}
            delay={0.18 + i * 0.06}
            onMarcado={() => alMarcar(habit.habit_id)}
          />
        ))}
      </div>

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

            {/* El mismo selector de Hoy, no una copia: si algún día cambian las
                caras o cómo se guarda, cambian en los dos sitios a la vez. */}
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
    </>
  );
}
