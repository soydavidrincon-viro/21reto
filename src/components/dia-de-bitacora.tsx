"use client";

import { CaretDown, Lightning, PencilSimple } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { saveJournal } from "@/app/(app)/hoy/actions";
import { HabitIcon } from "@/components/habit-icon";
import { longDate } from "@/lib/dates";
import { MOOD_BY_KEY, MOODS, TRIGGER_BY_KEY } from "@/lib/types";

export type HabitoDelDia = { id: string; name: string; icon: string };

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

/**
 * Un día del historial, que se abre y se puede escribir.
 *
 * Lo de escribir faltaba y era un cabo suelto, no una decisión: el editor
 * estaba clavado al día de hoy, así que quien se olvidaba de escribir el martes
 * no tenía forma de volver — aunque `saveJournal` acepta cualquier fecha desde
 * el primer día. Los hábitos sí se podían corregir desde el calendario; la
 * bitácora, no.
 *
 * El resumen de arriba dice qué pasó en números, y abriéndolo salen los
 * nombres, las horas y el botón de escribir. Cerrado por defecto: el historial
 * se recorre de un vistazo y se abre lo que llama la atención.
 */
export function DiaDeBitacora({
  dia,
  esHoy,
}: {
  dia: DiaDeBitacora;
  esHoy: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Copia local de lo guardado, para que la fila cambie en el acto y no
  // después de que vuelva el servidor.
  const [guardado, setGuardado] = useState({
    mood: dia.mood,
    nota: dia.nota,
  });
  const [mood, setMood] = useState(dia.mood);
  const [nota, setNota] = useState(dia.nota ?? "");

  const cara = guardado.mood ? MOOD_BY_KEY.get(guardado.mood) : undefined;
  const aguantados = dia.impulsos.filter((i) => i.resistido).length;
  const hayDetalle =
    dia.cumplidos.length + dia.recaidas.length + dia.impulsos.length > 0;

  const resumen: string[] = [];
  if (dia.cumplidos.length > 0) {
    resumen.push(
      `${dia.cumplidos.length} ${dia.cumplidos.length === 1 ? "cumplido" : "cumplidos"}`,
    );
  }
  if (dia.recaidas.length > 0) {
    resumen.push(
      `${dia.recaidas.length} ${dia.recaidas.length === 1 ? "recaída" : "recaídas"}`,
    );
  }
  if (dia.impulsos.length > 0) {
    resumen.push(
      `${dia.impulsos.length} ${dia.impulsos.length === 1 ? "impulso" : "impulsos"}`,
    );
  }

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
    });
  }

  function cancelar() {
    setMood(guardado.mood);
    setNota(guardado.nota ?? "");
    setEditando(false);
    setError(null);
  }

  return (
    <li className="flex flex-col rounded-2xl bg-card">
      <div className="flex gap-3 px-4 pt-3.5">
        <span
          aria-label={cara?.label ?? "Sin ánimo"}
          className="shrink-0 text-[26px] leading-none"
        >
          {cara?.emoji ?? "•"}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-baseline gap-2">
              {esHoy && (
                <span className="rounded-md bg-azul px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-azul-tinta">
                  Hoy
                </span>
              )}
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-label">
                {longDate(dia.fecha)}
              </span>
            </span>
            {dia.cumplidos.length > 0 && (
              <span
                aria-hidden="true"
                className="flex shrink-0 items-center gap-1 text-menta"
              >
                {dia.cumplidos.slice(0, 4).map((habit) => (
                  <HabitIcon key={habit.id} clave={habit.icon} size={16} />
                ))}
              </span>
            )}
          </div>

          {guardado.nota && (
            <p className="whitespace-pre-line text-pretty text-[15px] leading-[1.4] tracking-[-0.01em] text-label-2">
              {guardado.nota}
            </p>
          )}
        </div>
      </div>

      {/* El desplegable va siempre, aunque no haya nada que resumir: es también
          la puerta a escribir ese día, y esconderla en los días vacíos dejaría
          fuera justo los que hay que rellenar. */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex items-center gap-1.5 px-4 pb-3.5 pt-2 text-left text-[12.5px] font-medium text-label-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-azul"
      >
        <span className="min-w-0 flex-1 truncate">
          {hayDetalle ? (
            <>
              {resumen.join(" · ")}
              {dia.impulsos.length > 0 && (
                <span className="text-menta">
                  {" "}
                  · {aguantados} aguantado{aguantados === 1 ? "" : "s"}
                </span>
              )}
            </>
          ) : (
            <span className="text-label-3">
              {cara ? "Ver y editar" : "Sin nada registrado"}
            </span>
          )}
        </span>
        <CaretDown
          size={14}
          weight="bold"
          aria-hidden="true"
          className={`shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <div className="flex flex-col gap-2.5 border-t border-separator px-4 py-3">
          {dia.cumplidos.length > 0 && (
            <Lista titulo="Cumplidos" habitos={dia.cumplidos} tono="text-menta" />
          )}
          {dia.recaidas.length > 0 && (
            <Lista titulo="Recaídas" habitos={dia.recaidas} tono="text-ambar" />
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

          {editando ? (
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
              {cara ? "Editar este día" : "Escribir este día"}
            </button>
          )}
        </div>
      )}
    </li>
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
