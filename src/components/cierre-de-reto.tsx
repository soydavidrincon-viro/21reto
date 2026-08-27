"use client";

import { ArrowRight, Archive, Trophy } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { archiveHabit, extendHabit } from "@/app/actions/habits";
import { Companion, type CompanionKey } from "@/components/companion";
import { MILESTONES } from "@/lib/milestones";
import { comoSeLee, HABIT_SKIN, type DailyOverviewRow } from "@/lib/types";

/**
 * Qué pasa el día 22.
 *
 * Antes: nada. Se llegaba a la meta, la barra se quedaba llena y ahí acababa
 * todo — la app perdía exactamente a la persona que le funcionó. Y de paso
 * dejaba en pie el mito: veintiún días no rompen una adicción, ese número sale
 * de un libro de cirugía plástica de los sesenta y no de la evidencia.
 *
 * Así que esto no dice "terminaste". Dice que cumpliste el primer tramo y pone
 * tres salidas: seguir hasta el siguiente escalón, poner una meta propia, o
 * archivarlo porque ya no es un reto sino cómo vives. Las tres son válidas y
 * ninguna está pintada como la correcta.
 */
export function CierreDeReto({
  habit,
  companion,
}: {
  habit: DailyOverviewRow;
  companion: CompanionKey;
}) {
  const [pending, startTransition] = useTransition();
  const [propia, setPropia] = useState("");
  const [error, setError] = useState<string | null>(null);
  const skin = HABIT_SKIN[habit.color];

  const siguiente =
    MILESTONES.find((d) => d > habit.target_days) ?? habit.target_days * 2;

  function subirMeta(meta: number) {
    setError(null);
    startTransition(async () => {
      const result = await extendHabit(habit.habit_id, meta);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <section
      className="entrar relative overflow-hidden rounded-[26px] px-5 pb-5 pt-6 lg:px-7 lg:pb-6 lg:pt-7"
      style={{ background: skin.fondo }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span
            className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.1em] opacity-70"
            style={{ color: skin.tinta }}
          >
            <Trophy size={14} weight="fill" aria-hidden="true" />
            Reto cumplido · {habit.target_days} días
          </span>
          <h2
            className="font-display text-[26px] font-semibold leading-[1.1] tracking-[-0.01em] lg:text-[30px]"
            style={{ color: skin.tinta }}
          >
            {habit.name}
          </h2>
          <p
            className="max-w-[42ch] text-pretty text-[14px] leading-[1.45] opacity-80"
            style={{ color: skin.tinta }}
          >
            Llevas {habit.clean_days} días {comoSeLee(habit.kind, habit.name)} y
            tu mejor racha fue de {habit.best_streak}. Esto no se acaba aquí: el
            día {habit.target_days + 1} también cuenta.
          </p>
        </div>
        <Companion
          who={companion}
          size={78}
          mood="celebra"
          etapa={3}
          sombra={false}
          className="salta shrink-0"
        />
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => subirMeta(siguiente)}
          className="pulsable flex h-[52px] items-center justify-between gap-2 rounded-[16px] bg-card px-4 text-left text-[15px] font-semibold text-label disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          <span className="flex flex-col">
            Seguir contando hasta {siguiente}
            <small className="text-[12px] font-medium text-label-2">
              Tus {habit.clean_days} días siguen contando
            </small>
          </span>
          <ArrowRight size={18} weight="bold" aria-hidden="true" />
        </button>

        <div className="flex gap-2">
          <label className="sr-only" htmlFor={`meta-${habit.habit_id}`}>
            Meta propia en días
          </label>
          <input
            id={`meta-${habit.habit_id}`}
            type="number"
            inputMode="numeric"
            min={habit.target_days + 1}
            max={3650}
            value={propia}
            onChange={(event) => setPropia(event.target.value)}
            placeholder="Otra meta"
            className="h-11 w-full min-w-0 rounded-xl bg-card px-3.5 text-[15px] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          />
          <button
            type="button"
            disabled={pending || !propia}
            onClick={() => subirMeta(Number(propia))}
            className="pulsable h-11 shrink-0 rounded-xl bg-card px-4 text-[14px] font-semibold text-label disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            Poner
          </button>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await archiveHabit(habit.habit_id);
              if (result?.error) setError(result.error);
            })
          }
          className="flex h-11 items-center justify-center gap-1.5 text-[14px] font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          style={{ color: skin.tinta, opacity: 0.85 }}
        >
          <Archive size={16} weight="bold" aria-hidden="true" />
          Archivarlo: ya no es un reto
        </button>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-card px-3 py-2 text-[13px] text-rojo"
          >
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
