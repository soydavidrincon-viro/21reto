"use client";

import { Archive, Trash } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { archiveHabit, deleteHabit } from "@/app/actions/habits";

/**
 * Archivar o borrar un reto.
 *
 * Son cosas distintas y por eso están las dos. Archivar conserva todo el
 * historial y solo lo saca de Hoy: sirve para algo que ya no es un reto sino
 * cómo vives. Borrar se lleva los registros y los antojos, y es lo que hace
 * falta para los tres o cuatro que cualquiera crea al probar la app — dejarlos
 * archivados sería guardar basura para siempre.
 *
 * Borrar pide confirmación en dos pasos, como quitar un día marcado, porque no
 * hay vuelta atrás. Pero no pide escribir "ELIMINAR" como la cuenta entera: eso
 * es para algo que no se puede rehacer, y un hábito se vuelve a crear en diez
 * segundos. Poner la misma fricción a las dos cosas enseña a la gente a saltarse
 * la fricción.
 */
export function GestionDeReto({
  habitId,
  nombre,
}: {
  habitId: string;
  nombre: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2.5 rounded-[22px] bg-card px-4 py-3.5 lg:px-5 lg:py-4">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-label">
        Este reto
      </h2>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await archiveHabit(habitId);
            if (result?.error) setError(result.error);
          })
        }
        className="pulsable flex h-11 items-center gap-2.5 rounded-xl bg-fill px-3.5 text-left text-[14.5px] font-medium text-label disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
      >
        <Archive size={17} aria-hidden="true" className="shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col">
          Archivar
          <small className="text-[12px] text-label-2">
            Sale de Hoy y guarda todo el historial
          </small>
        </span>
      </button>

      {confirmando ? (
        <div className="flex flex-col gap-2 rounded-xl bg-fill p-3">
          <p className="text-pretty text-[13.5px] leading-[1.4] text-label">
            Se va <b>{nombre}</b> con todos sus días marcados y sus antojos. No
            se puede deshacer.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteHabit(habitId);
                  if (result?.error) setError(result.error);
                })
              }
              className="pulsable h-11 flex-1 rounded-xl bg-rojo text-[14.5px] font-semibold text-rojo-tinta disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              {pending ? "Borrando…" : "Sí, bórralo"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="pulsable h-11 flex-1 rounded-xl bg-card text-[14.5px] font-semibold text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmando(true)}
          className="pulsable flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-left text-[14.5px] font-medium text-rojo disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          <Trash size={17} aria-hidden="true" className="shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            Eliminar
            <span className="text-[12px] text-label-2">
              Borra el reto y todo lo que lleva registrado
            </span>
          </span>
        </button>
      )}

      {error && (
        <p role="alert" className="text-[13px] text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
