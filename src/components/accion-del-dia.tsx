"use client";

import { ArrowCounterClockwise, Check, Moon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { clearDay, markDay } from "@/app/(app)/hoy/actions";
import { useCelebracion } from "@/components/celebracion";
import { useCierreDelDia } from "@/components/cierre-del-dia";
import type { DailyOverviewRow } from "@/lib/types";

/**
 * El botón de marcar el día. Vive en la tarjeta del carrusel y en la fila
 * compacta, que es por lo que es un componente y no un trozo de tarjeta.
 *
 * Marcar es de un toque; desmarcar, de dos. Antes el mismo botón hacía las
 * dos cosas, así que volver a tocarlo por costumbre —o para comprobar que sí
 * había quedado— borraba el día sin decir nada. Perder un día marcado por un
 * toque de más es exactamente el tipo de cosa que hace que alguien deje de
 * usar la app.
 *
 * En un día que no toca el botón sigue ahí, apagado y diciendo "libre". Sigue
 * tocable a propósito: si alguien fue al gimnasio un miércoles que no tocaba,
 * eso cuenta.
 */
export function AccionDelDia({
  habit,
  today,
  variante,
}: {
  habit: DailyOverviewRow;
  today: string;
  /** "grande" ocupa el ancho de la tarjeta; "fila" es un círculo de 44px. */
  variante: "grande" | "fila";
}) {
  const [pending, startTransition] = useTransition();
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { celebrar, elemento } = useCelebracion();
  const cierre = useCierreDelDia();

  const done = habit.today_status === "success";
  const relapsed = habit.today_status === "relapse";
  const descanso = !habit.toca_hoy && !done && !relapsed;
  const construye = habit.kind === "build";

  function alTocar() {
    if (done && !deshaciendo) {
      setDeshaciendo(true);
      setTimeout(() => setDeshaciendo(false), 4000);
      return;
    }

    setError(null);
    startTransition(async () => {
      if (done) {
        const result = await clearDay(habit.habit_id, today);
        if (result.error) setError(result.error);
        setDeshaciendo(false);
        return;
      }
      const result = await markDay(habit.habit_id, today, "success");
      if (result.error) {
        setError(result.error);
        return;
      }
      celebrar(result.streak, {
        nombre: habit.name,
        kind: habit.kind,
        targetDays: habit.target_days,
        premio: habit.premio,
      });
      cierre?.alMarcar(habit.habit_id);
    });
  }

  const etiqueta = deshaciendo
    ? `Confirmar que quieres quitar ${habit.name} de hoy`
    : done
      ? `${habit.name} está marcado hoy. Tocar para quitarlo.`
      : descanso
        ? `Hoy no toca ${habit.name}. Tocar para marcarlo igual.`
        : `Marcar ${habit.name} de hoy`;

  // Con recaída registrada el botón no ofrece "marcar": pisaría la recaída
  // con un limpio de un toque. Se quita desde la esquina de la tarjeta o el
  // detalle, con confirmación. En la tarjeta el bloque trae el porqué que la
  // persona escribió al crear el reto: es justo cuando más sirve leerlo.
  if (relapsed) {
    if (variante === "fila") {
      return (
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ambar text-ambar-tinta"
          aria-label={construye ? "Hoy quedó saltado" : "Recaída registrada hoy"}
        >
          !
        </span>
      );
    }
    return (
      <div
        role="status"
        className="flex flex-col gap-1 rounded-[14px] bg-ambar px-4 py-3 text-ambar-tinta"
      >
        <b className="text-[14.5px] font-semibold">
          {construye ? "Hoy quedó saltado" : "Recaída registrada hoy"}
        </b>
        <p className="text-pretty text-[13px] leading-[1.35] opacity-90">
          El reto vuelve a empezar mañana.
          {habit.motivo && ` Tú dijiste: “${habit.motivo}”.`}
        </p>
      </div>
    );
  }

  const icono = deshaciendo ? (
    <ArrowCounterClockwise size={variante === "grande" ? 20 : 20} weight="bold" aria-hidden="true" />
  ) : descanso ? (
    <Moon size={20} weight="fill" aria-hidden="true" />
  ) : (
    <Check size={variante === "grande" ? 22 : 22} weight="bold" aria-hidden="true" />
  );

  if (variante === "fila") {
    return (
      <>
        {elemento}
        <button
          type="button"
          onClick={alTocar}
          disabled={pending}
          aria-label={etiqueta}
          className={`pulsable flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
            deshaciendo
              ? "bg-ambar text-ambar-tinta"
              : done
                ? "bg-menta text-menta-tinta"
                : descanso
                  ? "bg-fill text-label-3"
                  : "bg-card text-label-2 ring-2 ring-inset ring-separator"
          }`}
        >
          {icono}
        </button>
        {error && (
          <p role="alert" className="sr-only">
            {error}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {elemento}
      <button
        type="button"
        onClick={alTocar}
        disabled={pending}
        aria-label={etiqueta}
        className={`pulsable flex h-[52px] items-center justify-center gap-2 rounded-[16px] text-[16px] font-semibold tracking-[-0.01em] transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
          deshaciendo
            ? "bg-ambar text-ambar-tinta"
            : done
              ? "bg-menta text-menta-tinta"
              : descanso
                ? "bg-black/10 text-label-2"
                : "bg-card text-label"
        }`}
      >
        {icono}
        {deshaciendo
          ? "¿Quitar lo de hoy?"
          : done
            ? "Hecho por hoy"
            : descanso
              ? "Hoy no toca. Marcar igual"
              : construye
                ? "Hecho"
                : "Hoy sigo limpio"}
      </button>
      {error && (
        <p role="alert" className="text-[13px] leading-[1.35] text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
