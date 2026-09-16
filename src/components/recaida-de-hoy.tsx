"use client";

import { useState, useTransition } from "react";
import { clearDay, markDay } from "@/app/(app)/hoy/actions";
import { HojaDeRecaida } from "@/components/hoja-de-recaida";
import { longDate } from "@/lib/dates";
import type { DailyOverviewRow } from "@/lib/types";

/**
 * La segunda salida del día en la tarjeta de Hoy: decir que recaíste.
 *
 * Es texto y no botón a propósito. Va en la misma fila que "Ver calendario y
 * ajustes", al mismo peso: quien recayó lo encuentra porque está justo
 * debajo del botón que ya conoce, y quien va limpio no ve un botón ámbar
 * mirándolo cada mañana. La hoja pide confirmar y deja escribir qué pasó.
 *
 * Con la recaída ya registrada, la misma esquina ofrece "Quitar", con doble
 * toque igual que desmarcar un día limpio: perder un registro por un toque
 * de más es lo que hace que alguien deje de usar la app.
 */
export function RecaidaDeHoy({
  habit,
  today,
  tinta,
}: {
  habit: DailyOverviewRow;
  today: string;
  /** La tinta de la tarjeta, para que el texto se lea sobre su color. */
  tinta: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const construye = habit.kind === "build";
  const relapsed = habit.today_status === "relapse";

  const enlace =
    "flex h-9 items-center rounded-lg px-1 text-[13.5px] font-semibold opacity-75 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

  function registrar(nota: string) {
    setError(null);
    startTransition(async () => {
      const result = await markDay(
        habit.habit_id,
        today,
        "relapse",
        nota || undefined,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setAbierta(false);
    });
  }

  function quitar() {
    if (!confirmandoQuitar) {
      setConfirmandoQuitar(true);
      setTimeout(() => setConfirmandoQuitar(false), 4000);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await clearDay(habit.habit_id, today);
      if (result.error) setError(result.error);
      setConfirmandoQuitar(false);
    });
  }

  if (relapsed) {
    return (
      <>
        <button
          type="button"
          disabled={pending}
          onClick={quitar}
          aria-label={
            confirmandoQuitar
              ? "Confirmar que quieres quitar el registro de hoy"
              : construye
                ? "Quitar el día saltado"
                : "Quitar la recaída de hoy"
          }
          className={enlace}
          style={{ color: tinta }}
        >
          {confirmandoQuitar ? "¿Quitar? Toca otra vez" : "Quitar"}
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
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setAbierta(true)}
        className={enlace}
        style={{ color: tinta }}
      >
        {construye ? "Hoy me lo salté" : "Hoy recaí"}
      </button>

      {abierta && (
        <HojaDeRecaida
          fecha={longDate(today)}
          subtitulo={`${habit.name} · hoy`}
          titulo={construye ? "Registrar el día saltado" : "Registrar una recaída"}
          texto={
            habit.clean_days > 0
              ? `El reto vuelve a cero: tus ${habit.clean_days} ${habit.clean_days === 1 ? "día queda" : "días quedan"} en el historial y en tu mejor racha. Nada se borra.`
              : "El reto sigue en cero. El día queda en tu historial, en amarillo."
          }
          accion="Registrar"
          secundaria={{ label: "Cancelar", onClick: () => setAbierta(false) }}
          pending={pending}
          error={error}
          onConfirmar={registrar}
          onClose={() => setAbierta(false)}
        />
      )}
    </>
  );
}
