"use client";

import { useState, useTransition } from "react";
import { clearDay, markDay } from "@/app/(app)/hoy/actions";
import { HojaDeRecaida } from "@/components/hoja-de-recaida";
import { longDate } from "@/lib/dates";
import type { DailyOverviewRow } from "@/lib/types";

/**
 * La segunda salida del día en la tarjeta de Hoy: decir que recaíste.
 *
 * Un botón con borde y sin relleno, del ancho de "Hoy sigo limpio" y un poco
 * más bajo. Empezó como texto en una esquina y en el teléfono no se veía ni
 * parecía tocable; el borde lo hace botón sin competir con el blanco, y sin
 * meter un bloque ámbar que quien va limpio tenga que mirar cada mañana. La
 * hoja pide confirmar y deja escribir qué pasó.
 *
 * Con la recaída ya registrada, el mismo botón ofrece quitarla, con doble
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

  // El borde va con la tinta de la tarjeta; sin relleno, para que el botón
  // blanco de arriba siga siendo el principal.
  const boton =
    "pulsable flex h-11 w-full items-center justify-center rounded-[14px] border-2 text-[15px] font-semibold tracking-[-0.01em] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";
  const estilo = { color: tinta, borderColor: tinta, opacity: 0.85 };

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
          className={boton}
          style={estilo}
        >
          {confirmandoQuitar
            ? "¿Quitar? Toca otra vez"
            : construye
              ? "Quitar el día saltado"
              : "Quitar la recaída de hoy"}
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
        className={boton}
        style={estilo}
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
