"use client";

import { useState, useTransition } from "react";
import { anotarDiasAsumidos } from "@/app/(app)/hoy/actions";
import { HojaDeRecaida } from "@/components/hoja-de-recaida";
import { listaDeDias } from "@/lib/dates";

export type DiasSinMarcarDeUnHabito = {
  habitId: string;
  nombre: string;
  kind: "quit" | "build";
  fechas: string[];
};

/**
 * La app cerró uno o más días que tocaban y quedaron sin marcar, y pregunta
 * qué pasó. Sale sola al abrir Hoy, una vez por día: Guardar o Sin nota lo
 * dejan contestado; cerrar la hoja sin tocar nada la vuelve a enseñar la
 * próxima vez.
 *
 * Con varios hábitos se contesta uno a uno: la hoja enseña el primero y, al
 * contestarlo, pasa al siguiente. No hay nada que devuelva el reto: el título
 * dice "contó como recaída" y no pregunta si fue así.
 */
export function DiasSinMarcar({
  pendientes,
}: {
  pendientes: DiasSinMarcarDeUnHabito[];
}) {
  const [cola, setCola] = useState(pendientes);
  const [abierta, setAbierta] = useState(pendientes.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const actual = cola[0];
  if (!abierta || !actual) return null;

  const construye = actual.kind === "build";
  const varios = actual.fechas.length > 1;

  function contestar(nota: string) {
    setError(null);
    startTransition(async () => {
      const result = await anotarDiasAsumidos(
        actual.habitId,
        actual.fechas,
        nota || null,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setCola((lista) => lista.slice(1));
    });
  }

  return (
    <HojaDeRecaida
      key={actual.habitId}
      fecha={listaDeDias(actual.fechas)}
      subtitulo={`${actual.nombre} · sin marcar`}
      titulo={
        construye
          ? varios
            ? "Contaron como días saltados"
            : "Contó como día saltado"
          : varios
            ? "Contaron como recaída"
            : "Contó como recaída"
      }
      texto={`El reto volvió a cero y ${varios ? "esos días quedan" : "ese día queda"} en amarillo en tu calendario. Deja escrito qué pasó: te sirve la próxima vez que estés ahí.`}
      accion="Guardar"
      secundaria={{ label: "Sin nota", onClick: () => contestar("") }}
      pending={pending}
      error={error}
      onConfirmar={contestar}
      onClose={() => setAbierta(false)}
    >
      {cola.length > 1 && (
        <p className="text-center text-[12.5px] text-label-3">
          Después: {cola.slice(1).map((h) => h.nombre).join(", ")}
        </p>
      )}
    </HojaDeRecaida>
  );
}
