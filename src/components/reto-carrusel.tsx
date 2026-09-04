import { AccionDelDia } from "@/components/accion-del-dia";
import {
  Companion,
  type CompanionEtapa,
  type CompanionKey,
  type CompanionMood,
} from "@/components/companion";
import { Huecos } from "@/components/huecos";
import { faltaPara } from "@/lib/milestones";
import { HABIT_SKIN, type DailyOverviewRow } from "@/lib/types";

/**
 * Hasta cuántos días se dibuja la barra casilla a casilla.
 *
 * Sale de medir: en la tarjeta más estrecha que existe —un iPhone SE, 320px de
 * pantalla menos los márgenes— quedan unos 250px útiles. Con 30 casillas y 3px
 * de hueco cada una mide 5px, que todavía se distingue. Con 60 baja de 1px y ya
 * no es una cuenta de días, es una textura.
 */
const MAX_CASILLAS = 31;

/**
 * Los retos activos, uno al lado del otro y con arrastre.
 *
 * Es la única vista de los hábitos en Hoy: cada tarjeta trae su botón de
 * marcar, la pregunta por los días sin contestar y cuánto falta para lo
 * próximo. Antes había además una lista debajo con los mismos números, y en
 * teléfono eso eran dos pantallas de scroll para llegar al botón de
 * emergencia.
 *
 * Scroll con `scroll-snap` y nada de JavaScript, así que funciona con el dedo
 * en el teléfono, con la rueda en escritorio y sin hidratar. Solo los botones
 * de dentro son de cliente.
 */
export function RetoCarrusel({
  habits,
  today,
  companion,
  humor,
  etapa,
}: {
  habits: DailyOverviewRow[];
  today: string;
  companion: CompanionKey;
  humor: CompanionMood;
  etapa: CompanionEtapa;
}) {
  // Los retos cumplidos tienen su propia tarjeta de cierre arriba, así que
  // aquí solo van los que siguen en marcha. Repetirlos sería enseñar dos veces
  // lo mismo y una de las dos con la barra congelada en el tope.
  const enMarcha = habits.filter((h) => h.clean_days < h.target_days);
  if (enMarcha.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 lg:px-0"
        style={{ scrollbarWidth: "none" }}
        aria-label="Tus retos activos"
      >
        {enMarcha.map((habit, i) => {
          const skin = HABIT_SKIN[habit.color];
          const progreso = Math.min(
            100,
            (habit.clean_days / habit.target_days) * 100,
          );
          const porDias = habit.target_days <= MAX_CASILLAS;
          const falta = faltaPara(habit.current_streak, habit.target_days);
          const conHuecos = habit.pendientes.length > 0;

          return (
            <section
              key={habit.habit_id}
              className="entrar relative w-full shrink-0 snap-center overflow-hidden rounded-[26px] px-5 pb-5 pt-6 lg:px-7 lg:pb-7 lg:pt-8"
              style={{
                background: skin.fondo,
                animationDelay: `${0.06 + i * 0.05}s`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span
                    className="text-[11.5px] font-bold uppercase tracking-[0.1em] opacity-65"
                    style={{ color: skin.tinta }}
                  >
                    {habit.kind === "build"
                      ? "Hábito en marcha"
                      : "Reto activo"}
                    {enMarcha.length > 1 && ` · ${i + 1} de ${enMarcha.length}`}
                  </span>
                  <h2
                    className="font-display text-[27px] font-semibold leading-[1.1] tracking-[-0.01em] lg:text-[32px]"
                    style={{ color: skin.tinta }}
                  >
                    {habit.name}
                  </h2>
                </div>

                <div className="flex flex-col items-end">
                  <span
                    className="tnum font-display text-[46px] font-bold leading-none tracking-[-0.03em] lg:text-[56px]"
                    style={{ color: skin.tinta }}
                  >
                    {habit.clean_days}
                  </span>
                  <span
                    className="tnum text-[13px] font-semibold opacity-70"
                    style={{ color: skin.tinta }}
                  >
                    de {habit.target_days} días
                  </span>
                </div>
              </div>

              <div
                className="mt-4"
                role="progressbar"
                aria-valuenow={habit.clean_days}
                aria-valuemin={0}
                aria-valuemax={habit.target_days}
                aria-label={`Progreso de ${habit.name}: ${habit.clean_days} de ${habit.target_days} días`}
              >
                {porDias ? (
                  // Una casilla por día. La barra lisa decía lo mismo, pero un
                  // 62% no se siente como diecinueve días: la casilla que se
                  // enciende mañana está ahí, a la vista y contable con el
                  // dedo, y eso es lo que hace que valga la pena encenderla.
                  <div className="flex gap-[3px]">
                    {Array.from({ length: habit.target_days }, (_, dia) => (
                      <span
                        key={dia}
                        className="h-3 flex-1 rounded-[2px]"
                        style={{
                          background: skin.tinta,
                          // Sin opacity 0 en las que faltan: en un fondo de
                          // color, transparente es invisible y la barra se
                          // quedaría en solo la parte hecha, que es justo la
                          // mitad que ya se sabe.
                          opacity: dia < habit.clean_days ? 0.95 : 0.22,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  // Con metas largas las casillas se vuelven rayas de menos de
                  // dos píxeles en un teléfono: ahí no se cuenta nada y solo
                  // queda un peine. Para eso sigue la barra lisa.
                  <div
                    className="h-3 overflow-hidden rounded-full"
                    style={{ background: "rgba(0,0,0,0.16)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${progreso}%`,
                        background: skin.tinta,
                        opacity: 0.9,
                      }}
                    />
                  </div>
                )}
              </div>

              {conHuecos && (
                <div className="mt-4">
                  <Huecos habit={habit} today={today} tinta={skin.tinta} />
                </div>
              )}

              <div className="mt-4 flex items-end justify-between gap-3">
                <p
                  className="max-w-[62%] text-pretty text-[14px] leading-[1.4] opacity-80"
                  style={{ color: skin.tinta }}
                >
                  {/* Cuánto falta para lo próximo que valga la pena nombrar:
                      "faltan 3 para tu semana" dice más que "18 de 21". Con
                      racha en cero, solo la invitación. */}
                  {habit.current_streak === 0
                    ? "Hoy puede ser el día uno."
                    : falta
                      ? `Racha de ${habit.current_streak}. ${falta.texto}.`
                      : `Racha de ${habit.current_streak} ${habit.current_streak === 1 ? "día" : "días"}.`}
                </p>
                {/* El compañero va en todas las tarjetas. Se duerme cuando hay
                    días sin contestar: no regaña, espera. */}
                <Companion
                  who={companion}
                  size={92}
                  mood={conHuecos ? "dormido" : humor}
                  etapa={etapa}
                  className={`shrink-0 ${humor === "apagado" || conHuecos ? "" : "flota"}`}
                  sombra={false}
                />
              </div>

              <div className="relative mt-3">
                <AccionDelDia habit={habit} today={today} variante="grande" />
              </div>
            </section>
          );
        })}
      </div>

      {enMarcha.length > 1 && (
        <p className="px-6 text-[12px] text-label-3 lg:px-0">
          Desliza para ver tus otros retos.
        </p>
      )}
    </div>
  );
}
