"use client";

import { Portal, useHojaModal } from "@/components/portal";

import { Archive, DotsThree, Trash, X } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { archiveHabit, deleteHabit } from "@/app/actions/habits";

/**
 * Archivar o borrar un reto, escondido detrás de un botón pequeño.
 *
 * Antes era una tarjeta abierta al pie de la pantalla, con "Eliminar" en rojo a
 * la vista. Eso está mal repartido: son las dos únicas acciones sin vuelta atrás
 * de todo el detalle y eran las que más sitio ocupaban. Una tarjeta grande
 * invita a tocarla, y aquí se quiere lo contrario — que estén, que se
 * encuentren cuando se buscan, y que nadie se tropiece con ellas.
 *
 * Ahora es un botón de tres puntos en la cabecera, del tamaño de un icono, que
 * abre una hoja. Archivar y borrar siguen siendo cosas distintas: archivar
 * conserva el historial y solo lo saca de Hoy —para algo que ya no es un reto
 * sino cómo vives—, y borrar se lleva los registros y los impulsos, que es lo
 * que hace falta para los tres o cuatro que cualquiera crea al probar la app.
 *
 * Borrar pide confirmación, pero no pide escribir "ELIMINAR" como la cuenta
 * entera: eso es para algo que no se puede rehacer, y un hábito se vuelve a
 * crear en diez segundos. Poner la misma fricción a las dos cosas enseña a la
 * gente a saltarse la fricción.
 */
export function GestionDeReto({
  habitId,
  nombre,
}: {
  habitId: string;
  nombre: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cerrar() {
    setAbierto(false);
    setConfirmando(false);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Opciones de ${nombre}`}
        className="pulsable flex size-11 shrink-0 items-center justify-center rounded-full text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
      >
        <DotsThree size={22} weight="bold" aria-hidden="true" />
      </button>

      {abierto && (
        <Hoja
          nombre={nombre}
          habitId={habitId}
          confirmando={confirmando}
          setConfirmando={setConfirmando}
          error={error}
          setError={setError}
          pending={pending}
          startTransition={startTransition}
          cerrar={cerrar}
        />
      )}
    </>
  );
}

/**
 * La hoja va aparte para que el hook del modal —foco, Escape, Tab— se monte y
 * desmonte con ella, y no con el botón de tres puntos que siempre está.
 */
function Hoja({
  nombre,
  habitId,
  confirmando,
  setConfirmando,
  error,
  setError,
  pending,
  startTransition,
  cerrar,
}: {
  nombre: string;
  habitId: string;
  confirmando: boolean;
  setConfirmando: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
  pending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
  cerrar: () => void;
}) {
  const hoja = useHojaModal(cerrar);

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
        {/* El fondo cierra al tocarlo, pero no es un control: Escape y el
            botón de cerrar ya hacen ese trabajo para el teclado, y un botón
            invisible del tamaño de la pantalla era el primer sitio al que
            llegaba el Tab. */}
        <div
          aria-hidden="true"
          onClick={cerrar}
          className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        />

        <div
          ref={hoja}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`Opciones de ${nombre}`}
          className="entrar relative flex w-full max-w-[460px] flex-col gap-3 rounded-t-[28px] bg-card p-5 outline-none sm:rounded-[28px]"
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
          }}
        >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-label">
                  {nombre}
                </h2>
                <button
                  type="button"
                  onClick={cerrar}
                  aria-label="Cerrar"
                  className="pulsable -mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                >
                  <X size={17} weight="bold" aria-hidden="true" />
                </button>
              </div>

              {confirmando ? (
                <div className="flex flex-col gap-2.5">
                  <p className="text-pretty text-[14px] leading-[1.45] text-label">
                    Se va <b>{nombre}</b> con todos sus días marcados y sus
                    impulsos. No se puede deshacer.
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
                      className="pulsable h-12 flex-1 rounded-[14px] bg-rojo text-[15px] font-semibold text-rojo-tinta disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                    >
                      {pending ? "Borrando…" : "Sí, bórralo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(false)}
                      className="pulsable h-12 flex-1 rounded-[14px] bg-fill text-[15px] font-semibold text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await archiveHabit(habitId);
                        if (result?.error) setError(result.error);
                      })
                    }
                    className="pulsable flex items-center gap-3 rounded-[16px] bg-fill px-3.5 py-3 text-left disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                  >
                    <Archive
                      size={19}
                      aria-hidden="true"
                      className="shrink-0 text-label-2"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="text-[15px] font-semibold text-label">
                        Archivar
                      </span>
                      <span className="text-[12.5px] text-label-2">
                        Sale de Hoy y guarda todo el historial
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setConfirmando(true)}
                    className="pulsable flex items-center gap-3 rounded-[16px] px-3.5 py-3 text-left disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                  >
                    <Trash
                      size={19}
                      aria-hidden="true"
                      className="shrink-0 text-rojo"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="text-[15px] font-semibold text-rojo">
                        Eliminar
                      </span>
                      <span className="text-[12.5px] text-label-2">
                        Borra el reto y todo lo que lleva registrado
                      </span>
                    </span>
                  </button>
                </>
              )}

              {error && (
                <p role="alert" className="text-[13px] text-rojo">
                  {error}
                </p>
              )}
        </div>
      </div>
    </Portal>
  );
}
