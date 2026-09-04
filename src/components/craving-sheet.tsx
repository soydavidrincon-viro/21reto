"use client";

import { Portal, useHojaModal } from "@/components/portal";

import { HandPalm, Lightning, X } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { logCraving } from "@/app/actions/cravings";
import { CRAVING_TRIGGERS, type DailyOverviewRow } from "@/lib/types";

/**
 * La hoja del botón de emergencia.
 *
 * Se toca en el momento, no al final del día, así que todo aquí está pensado
 * para alguien que tiene treinta segundos de paciencia: intensidad, disparador
 * y salida. La nota es opcional y va al final; obligar a escribir convertiría
 * el botón de emergencia en un formulario, y el formulario no se llena.
 *
 * Aguantar sale en verde y grande. Es el resultado que la app quiere y es más
 * trabajo que marcar un día. Caer sale al lado, del mismo tamaño y sin drama:
 * si registrar una caída se siente como confesar, nadie la registra, y entonces
 * los datos solo describen los días buenos.
 */
export function CravingSheet({
  habits,
  onClose,
}: {
  habits: DailyOverviewRow[];
  onClose: () => void;
}) {
  const [habitId, setHabitId] = useState<string | null>(
    habits.length === 1 ? habits[0].habit_id : null,
  );
  const [intensity, setIntensity] = useState(3);
  const [triggerKey, setTriggerKey] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmandoCaida, setConfirmandoCaida] = useState(false);
  const [caido, setCaido] = useState(false);
  const [pending, startTransition] = useTransition();
  const hoja = useHojaModal(onClose);

  const elegido = habits.find((h) => h.habit_id === habitId) ?? null;

  /**
   * Después de "Caí" la hoja no se cierra: se queda con lo que importa decir
   * en ese momento —que los días siguen ahí— y con el porqué que la persona
   * escribió, si lo escribió. Cerrarla de golpe dejaba a quien acaba de caer
   * mirando la pantalla de Hoy como si nada.
   */
  function guardar(resisted: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await logCraving({
        habitId,
        intensity,
        triggerKey,
        note: note || null,
        resisted,
      });
      if (result.error) setError(result.error);
      else if (resisted) onClose();
      else setCaido(true);
    });
  }

  /**
   * "Caí" no es un botón más, y hasta ahora se comportaba como si lo fuera.
   *
   * Hacía dos cosas opuestas sin decirlo. Con un solo hábito marcaba el día
   * como recaída y partía una racha de cuarenta días de un toque, sin
   * preguntar nada — la única acción irreversible de la app sin confirmación.
   * Con dos o más hábitos y ninguno elegido, guardaba el impulso y no tocaba
   * la racha, así que quien acababa de caer se quedaba con la racha intacta y
   * sin enterarse.
   *
   * Ahora hace una sola cosa y la dice antes: pide de cuál fue, avisa de que
   * eso marca el día, y pide un segundo toque.
   */
  function tocarCai() {
    if (!habitId) {
      setError("Dime de cuál fue para poder registrarlo.");
      return;
    }
    if (!confirmandoCaida) {
      setError(null);
      setConfirmandoCaida(true);
      return;
    }
    guardar(false);
  }

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
          aria-label="Registrar un impulso"
          className="entrar relative flex max-h-[92dvh] w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card p-5 outline-none sm:rounded-[28px]"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-[22px] font-semibold leading-none tracking-[-0.01em] text-label">
                Te están dando ganas
              </h2>
              <p className="text-[13.5px] leading-[1.4] text-label-2">
                Todavía no ha pasado nada. Registrarlo ya es hacer algo.
              </p>
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

          {caido && elegido ? (
            <>
              <div className="flex flex-col gap-2 rounded-[16px] bg-ambar/20 px-4 py-3.5">
                <p className="text-[15px] font-semibold text-label">
                  Queda anotado. Tus {elegido.clean_days}{" "}
                  {elegido.clean_days === 1 ? "día" : "días"} siguen ahí.
                </p>
                <p className="text-pretty text-[13.5px] leading-[1.45] text-label-2">
                  {elegido.relapse_policy === "reset"
                    ? "La racha vuelve a empezar mañana. Lo que ya hiciste no se borra."
                    : "La racha sigue contando. Una caída es un dato, no un veredicto."}
                </p>
              </div>
              {elegido.motivo && (
                <p className="text-pretty px-1 font-display text-[17px] font-medium leading-[1.4] text-label">
                  Tú dijiste: “{elegido.motivo}”
                </p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="pulsable h-[52px] rounded-[16px] bg-fill text-[16px] font-semibold text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
              >
                Cerrar
              </button>
            </>
          ) : (
          <>
          {habits.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3">
                ¿De cuál?
              </span>
              <div className="flex flex-wrap gap-1.5">
                {habits.map((habit) => (
                  <button
                    key={habit.habit_id}
                    type="button"
                    aria-pressed={habitId === habit.habit_id}
                    onClick={() => {
                      setHabitId(
                        habitId === habit.habit_id ? null : habit.habit_id,
                      );
                      // Cambiar de hábito con la confirmación abierta la
                      // cancela: si no, el segundo toque confirmaría una recaída
                      // en un hábito distinto del que se leyó en el aviso.
                      setConfirmandoCaida(false);
                      setError(null);
                    }}
                    className={`min-h-10 rounded-[20px] px-3.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                      habitId === habit.habit_id
                        ? "bg-azul text-azul-tinta"
                        : "bg-fill text-label"
                    }`}
                  >
                    {habit.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3">
                Qué tan fuerte
              </span>
              <span className="text-[13px] font-semibold text-label-2">
                {
                  ["Apenas", "Suave", "Normal", "Fuerte", "Durísimo"][
                    intensity - 1
                  ]
                }
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label="Intensidad del impulso"
              className="flex gap-1.5"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={intensity === n}
                  aria-label={`Intensidad ${n} de 5`}
                  onClick={() => setIntensity(n)}
                  className={`pulsable flex h-12 flex-1 items-center justify-center gap-0.5 rounded-xl text-[15px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                    intensity >= n
                      ? "bg-naranja text-naranja-tinta"
                      : "bg-fill text-label-3"
                  }`}
                >
                  <Lightning
                    size={16}
                    weight={intensity >= n ? "fill" : "regular"}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3">
              ¿Qué lo disparó?
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CRAVING_TRIGGERS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={triggerKey === t.key}
                  onClick={() =>
                    setTriggerKey(triggerKey === t.key ? null : t.key)
                  }
                  className={`min-h-10 rounded-[20px] px-3.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                    triggerKey === t.key
                      ? "bg-lila text-lila-tinta"
                      : "bg-fill text-label"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Qué estaba pasando (opcional)"
            aria-label="Nota del impulso"
            className="resize-none rounded-xl bg-fill p-3 text-[15px] leading-[1.45] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          />

          {/* Lo que la persona escribió al crear el reto, justo aquí, que es
              para lo que lo escribió. */}
          {elegido?.motivo && (
            <p className="text-pretty rounded-xl bg-fill px-3.5 py-2.5 font-display text-[16px] font-medium leading-[1.4] text-label">
              Tú dijiste: “{elegido.motivo}”
            </p>
          )}

          {error && (
            <p role="alert" className="text-[13px] leading-[1.35] text-rojo">
              {error}
            </p>
          )}

          {/* Lo que va a pasar, antes de que pase. Un botón que rompe una racha
            tiene que decirlo con el dedo todavía en el aire. */}
          {confirmandoCaida && elegido && (
            <p className="rounded-xl bg-ambar/20 px-3.5 py-2.5 text-pretty text-[13.5px] leading-[1.4] text-label">
              Esto marca hoy como recaída en <b>{elegido.name}</b>. Queda en tu
              historial y no borra los días que ya llevas. Toca otra vez para
              confirmar.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => guardar(true)}
              className="pulsable flex h-[56px] flex-[1.6] items-center justify-center gap-2 rounded-[16px] bg-menta text-[16px] font-semibold tracking-[-0.01em] text-menta-tinta disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              <HandPalm size={19} weight="fill" aria-hidden="true" />
              {pending ? "Guardando…" : "Lo aguanté"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={tocarCai}
              className={`pulsable flex h-[56px] flex-1 items-center justify-center rounded-[16px] text-[16px] font-semibold tracking-[-0.01em] text-ambar-tinta disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                confirmandoCaida ? "bg-ambar ring-2 ring-label" : "bg-ambar"
              }`}
            >
              {pending && confirmandoCaida
                ? "Guardando…"
                : confirmandoCaida
                  ? "Confirmar"
                  : "Caí"}
            </button>
          </div>
          </>
          )}
        </div>
      </div>
    </Portal>
  );
}
