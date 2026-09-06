"use client";

import { Lightning, Lock, PencilSimple } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { saveJournal } from "@/app/(app)/hoy/actions";
import { HabitIcon } from "@/components/habit-icon";
import { longDate } from "@/lib/dates";
import { MOODS, TRIGGER_BY_KEY } from "@/lib/types";

export type HabitoDelDia = {
  id: string;
  name: string;
  icon: string;
  kind: "quit" | "build";
};

export type ImpulsoDeBitacora = {
  hora: number;
  trigger: string | null;
  resistido: boolean;
  nota: string | null;
  habito: string | null;
};

export type DiaDeBitacora = {
  fecha: string;
  mood: string | null;
  nota: string | null;
  cumplidos: HabitoDelDia[];
  recaidas: HabitoDelDia[];
  impulsos: ImpulsoDeBitacora[];
};

/** Un día vacío, para abrir uno que no tiene nada y poder escribirlo. */
export function diaVacio(fecha: string): DiaDeBitacora {
  return { fecha, mood: null, nota: null, cumplidos: [], recaidas: [], impulsos: [] };
}

/**
 * Lo que pasó un día, con el botón de escribirlo.
 *
 * Vive aparte porque se abre desde dos sitios: dentro de la tarjeta del
 * historial y en la hoja que sale al tocar un día del calendario. Es el mismo
 * contenido y el mismo guardado, así que es el mismo componente.
 *
 * `bloqueado` es cuántos hábitos de hoy faltan por marcar: con alguno, el día
 * de hoy se lee pero no se escribe, y en vez del botón sale el candado. Los
 * días pasados llegan siempre con cero.
 */
export function DetalleDeDia({
  dia,
  bloqueado = 0,
  onGuardado,
}: {
  dia: DiaDeBitacora;
  bloqueado?: number;
  /** Para que quien pinta la cabecera se entere de lo que quedó guardado. */
  onGuardado?: (mood: string, nota: string | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [guardado, setGuardado] = useState({ mood: dia.mood, nota: dia.nota });
  const [mood, setMood] = useState(dia.mood);
  const [nota, setNota] = useState(dia.nota ?? "");

  // Un día saltado en algo que se construye no es una recaída, y la palabra
  // importa: es la diferencia entre "no fui a correr" y "volví a beber".
  const soloSaltados =
    dia.recaidas.length > 0 && dia.recaidas.every((h) => h.kind === "build");
  const tituloRecaidas = soloSaltados ? "Saltados" : "Recaídas";

  function guardar() {
    setError(null);
    startTransition(async () => {
      const limpia = nota.trim() === "" ? null : nota.trim();
      const result = await saveJournal(dia.fecha, {
        mood: mood ?? undefined,
        note: limpia,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setGuardado({ mood, nota: limpia });
      setEditando(false);
      if (mood) onGuardado?.(mood, limpia);
    });
  }

  function cancelar() {
    setMood(guardado.mood);
    setNota(guardado.nota ?? "");
    setEditando(false);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2.5">
      {dia.cumplidos.length > 0 && (
        <Lista titulo="Cumplidos" habitos={dia.cumplidos} tono="text-menta" />
      )}
      {dia.recaidas.length > 0 && (
        <Lista titulo={tituloRecaidas} habitos={dia.recaidas} tono="text-ambar" />
      )}

      {dia.impulsos.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-label-3">
            Impulsos
          </span>
          <ul className="flex flex-col gap-1">
            {dia.impulsos
              .slice()
              .sort((a, b) => a.hora - b.hora)
              .map((im, n) => (
                <li
                  key={`${im.hora}-${n}`}
                  className="flex items-center gap-2 text-[12.5px] text-label-2"
                >
                  <Lightning
                    size={13}
                    weight="fill"
                    aria-hidden="true"
                    className="shrink-0 text-naranja"
                  />
                  <span className="tnum shrink-0">
                    {String(im.hora).padStart(2, "0")}:00
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {im.habito ? `${im.habito} · ` : ""}
                    {im.trigger
                      ? TRIGGER_BY_KEY.get(im.trigger)?.label
                      : "Sin disparador"}
                    {im.nota ? ` · ${im.nota}` : ""}
                  </span>
                  <span
                    className={`shrink-0 font-semibold ${im.resistido ? "text-menta" : "text-ambar"}`}
                  >
                    {im.resistido ? "Aguantado" : "Caí"}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {bloqueado > 0 ? (
        <p className="flex items-start gap-2.5 rounded-xl bg-fill px-3.5 py-3 text-[13.5px] leading-[1.4] text-label-2">
          <Lock size={18} weight="fill" aria-hidden="true" className="mt-px shrink-0 text-label-3" />
          <span>
            Se abre cuando marques{" "}
            {bloqueado === 1 ? "tu hábito de hoy" : "tus hábitos de hoy"}.{" "}
            <span className="tnum font-semibold text-label">
              Te {bloqueado === 1 ? "falta" : "faltan"} {bloqueado}.
            </span>
          </span>
        </p>
      ) : editando ? (
        <div className="flex flex-col gap-2.5">
          <div
            role="radiogroup"
            aria-label={`Cómo te sentiste el ${longDate(dia.fecha)}`}
            className="grid grid-cols-6 gap-1.5"
          >
            {MOODS.map((option) => {
              const activa = mood === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={activa}
                  aria-label={option.label}
                  onClick={() => setMood(option.key)}
                  className={`pulsable flex h-10 items-center justify-center rounded-xl text-[22px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                    activa ? "bg-azul/15 ring-2 ring-azul ring-inset" : "bg-fill"
                  }`}
                >
                  <span aria-hidden="true">{option.emoji}</span>
                </button>
              );
            })}
          </div>

          <label className="sr-only" htmlFor={`nota-${dia.fecha}`}>
            Nota del {longDate(dia.fecha)}
          </label>
          <textarea
            id={`nota-${dia.fecha}`}
            rows={3}
            maxLength={4000}
            value={nota}
            onChange={(event) => setNota(event.target.value)}
            placeholder="¿Qué pasó ese día?"
            className="resize-none rounded-xl bg-fill p-3 text-[15px] leading-[1.45] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          />

          {error && (
            <p role="alert" className="text-[13px] leading-[1.35] text-rojo">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-label-3">
              {mood ? "" : "Elige una cara para guardar"}
            </span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={cancelar}
                className="pulsable h-10 rounded-xl bg-fill px-3.5 text-[14px] font-semibold text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={pending || !mood}
                className="pulsable h-10 rounded-xl bg-azul px-4 text-[14px] font-semibold text-azul-tinta disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
              >
                {pending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="pulsable flex h-10 items-center justify-center gap-1.5 self-start rounded-xl bg-fill px-3.5 text-[14px] font-semibold text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          <PencilSimple size={15} weight="bold" aria-hidden="true" />
          {guardado.mood ? "Editar este día" : "Escribir este día"}
        </button>
      )}
    </div>
  );
}

function Lista({
  titulo,
  habitos,
  tono,
}: {
  titulo: string;
  habitos: HabitoDelDia[];
  tono: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-label-3">
        {titulo}
      </span>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {habitos.map((habit) => (
          <li
            key={habit.id}
            className={`flex items-center gap-1.5 text-[13px] ${tono}`}
          >
            <HabitIcon clave={habit.icon} size={15} />
            <span className="text-label">{habit.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
