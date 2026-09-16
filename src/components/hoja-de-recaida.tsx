"use client";

import { Warning, X } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { Portal, useHojaModal } from "@/components/portal";

/** El tope del `check` de `habit_logs.note`. */
const MAX_NOTA = 1000;

/**
 * La hoja de una recaída. Es la misma pieza para dos momentos distintos:
 * cuando la persona registra la de hoy desde el detalle, y cuando la app
 * cerró un día sin marcar y pregunta qué pasó. Cambian el título, el texto y
 * los botones; lo que no cambia es el campo para escribir qué pasó.
 *
 * Amarillo y no rojo: la recaída es un dato del proceso, no una falta.
 */
export function HojaDeRecaida({
  fecha,
  subtitulo,
  titulo,
  texto,
  accion,
  secundaria,
  pending,
  error,
  onConfirmar,
  onClose,
  children,
}: {
  /** "Lunes 15 de septiembre" o "13, 14 y 15 de septiembre". */
  fecha: string;
  /** "Redes sociales · hoy", "Redes sociales · sin marcar". */
  subtitulo: string;
  titulo: string;
  texto: string;
  /** El botón ámbar: "Registrar", "Guardar". */
  accion: string;
  /** El botón gris: "Cancelar", "Sin nota". */
  secundaria: { label: string; onClick: () => void };
  pending: boolean;
  error: string | null;
  onConfirmar: (nota: string) => void;
  onClose: () => void;
  /** Más tarjetas debajo (varios hábitos con días sin marcar). */
  children?: ReactNode;
}) {
  const [nota, setNota] = useState("");
  const hoja = useHojaModal(onClose);

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
        <div
          aria-hidden="true"
          onClick={onClose}
          className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        />

        <div
          ref={hoja}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className="entrar relative flex max-h-[92dvh] w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card p-5 outline-none sm:rounded-[28px]"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-ambar text-ambar-tinta">
                <Warning size={22} weight="fill" aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-semibold tracking-[-0.01em] text-label">
                  {fecha}
                </span>
                <span className="text-[12.5px] text-label-2">{subtitulo}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="pulsable -mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              <X size={17} weight="bold" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="text-balance font-display text-[24px] font-semibold leading-[1.1] tracking-[-0.01em] text-label">
              {titulo}
            </h2>
            <p className="text-pretty text-[14.5px] leading-[1.4] text-label-2">
              {texto}
            </p>
          </div>

          <label className="sr-only" htmlFor="nota-recaida">
            Qué pasó
          </label>
          <textarea
            id="nota-recaida"
            rows={3}
            maxLength={MAX_NOTA}
            value={nota}
            onChange={(event) => setNota(event.target.value)}
            placeholder="¿Qué pasó? ¿Qué sentiste, qué lo disparó?"
            className="resize-none rounded-xl bg-fill p-3 text-[15px] leading-[1.45] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          />

          {error && (
            <p role="alert" className="text-[13px] leading-[1.35] text-rojo">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => onConfirmar(nota.trim())}
              className="pulsable h-12 flex-1 rounded-[14px] bg-ambar text-[15px] font-semibold text-ambar-tinta disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              {pending ? "Guardando…" : accion}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={secundaria.onClick}
              className="pulsable h-12 flex-1 rounded-[14px] bg-fill text-[15px] font-semibold text-label disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              {secundaria.label}
            </button>
          </div>

          {children}
        </div>
      </div>
    </Portal>
  );
}
