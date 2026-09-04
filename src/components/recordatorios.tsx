"use client";

import {
  Bell,
  BellRinging,
  BellSlash,
  Export,
  Plus,
  X,
} from "@phosphor-icons/react";
import { useState, useSyncExternalStore, useTransition } from "react";
import {
  guardarAvisos,
  guardarDispositivo,
  olvidarDispositivo,
} from "@/app/actions/push";
import {
  desuscribirse,
  iphoneSinInstalar,
  permisoActual,
  soportaAvisos,
  suscribirse,
} from "@/lib/push";
import { HORA_AVISO_POR_DEFECTO, type Profile } from "@/lib/types";

type Entorno = {
  soporta: boolean;
  permiso: NotificationPermission | "sin-soporte";
  iphoneSuelto: boolean;
};

/**
 * El snapshot tiene que ser el MISMO objeto entre renders o React entra en
 * bucle comparándolo. Por eso se calcula una vez y se guarda aquí fuera.
 *
 * No cambia durante la vida de la pestaña: si la persona instala la app o
 * cambia el permiso del sistema, eso pasa fuera y la app se recarga.
 */
let cacheEntorno: Entorno | null = null;

function leerEntorno(): Entorno {
  cacheEntorno ??= {
    soporta: soportaAvisos(),
    permiso: permisoActual(),
    iphoneSuelto: iphoneSinInstalar(),
  };
  return cacheEntorno;
}

/** Nada a lo que suscribirse: esto se lee una vez y ya. */
const sinCambios = () => () => {};

/**
 * Encender y apagar los recordatorios.
 *
 * Se abre desde la campana de Hoy y desde Perfil, y es la misma hoja: un
 * ajuste que vive en dos sitios con dos pantallas distintas acaba
 * desincronizándose, y encima obliga a arreglar cada cosa dos veces.
 *
 * El permiso del navegador se pide al tocar el interruptor, nunca al cargar la
 * app. Pedirlo de entrada es como te lo niegan para siempre: el navegador solo
 * pregunta una vez, y quien lo rechaza no puede volver atrás sin ir a los
 * ajustes del sistema.
 */
export function Recordatorios({
  profile,
  variante,
}: {
  profile: Profile;
  /** "campana" es el icono de la cabecera de Hoy; "fila", el bloque de Perfil. */
  variante: "campana" | "fila";
}) {
  const [abierta, setAbierta] = useState(false);
  const encendidos = profile.reminder_hour !== null;

  if (variante === "campana") {
    return (
      <>
        <button
          type="button"
          onClick={() => setAbierta(true)}
          aria-label={
            encendidos
              ? "Recordatorios encendidos. Tocar para cambiarlos."
              : "Encender recordatorios"
          }
          className="pulsable relative flex size-9 shrink-0 items-center justify-center rounded-full text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          {encendidos ? (
            <>
              <BellRinging size={21} weight="fill" className="text-azul" aria-hidden="true" />
              {/* Un punto en vez de un número: no hay nada que contar, solo
                  que están puestos. */}
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 size-[7px] rounded-full bg-menta ring-2 ring-grouped"
              />
            </>
          ) : (
            <Bell size={21} aria-hidden="true" />
          )}
        </button>
        {abierta && (
          <Hoja profile={profile} onClose={() => setAbierta(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="pulsable mx-4 flex items-center gap-3 rounded-[22px] bg-card px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul lg:mx-0 lg:px-5"
      >
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
            encendidos ? "bg-azul text-azul-tinta" : "bg-fill text-label-2"
          }`}
        >
          {encendidos ? (
            <BellRinging size={20} weight="fill" aria-hidden="true" />
          ) : (
            <BellSlash size={20} aria-hidden="true" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-label">
            Recordatorios
          </span>
          <span className="text-[12.5px] text-label-2">
            {encendidos
              ? `A las ${String(profile.reminder_hour).padStart(2, "0")}:00, hora tuya`
              : "Apagados"}
          </span>
        </span>
      </button>
      {abierta && <Hoja profile={profile} onClose={() => setAbierta(false)} />}
    </>
  );
}

function Hoja({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const [hora, setHora] = useState<number | null>(profile.reminder_hour);
  const [racha, setRacha] = useState(profile.avisa_racha);
  const [hito, setHito] = useState(profile.avisa_hito);
  const [dificil, setDificil] = useState(profile.avisa_hora_dificil);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Qué puede hacer este navegador. Va por useSyncExternalStore y no por un
  // efecto que llame a setState: en el servidor estas APIs no existen, así que
  // la primera pintada tiene que decir "todavía no sé" y la segunda ya el
  // valor real. Es exactamente para lo que sirve el snapshot de servidor.
  const entorno = useSyncExternalStore(sinCambios, leerEntorno, () => null);

  const encendidos = hora !== null;

  function encender() {
    setError(null);
    startTransition(async () => {
      const sub = await suscribirse();
      if (!sub) {
        setError(
          permisoActual() === "denied"
            ? "Tienes los avisos bloqueados para este sitio. Se cambia en los ajustes del navegador."
            : "No pudimos activarlos en este dispositivo.",
        );
        return;
      }

      const guardado = await guardarDispositivo(sub);
      if (guardado.error) {
        setError(guardado.error);
        return;
      }

      const nueva = hora ?? HORA_AVISO_POR_DEFECTO;
      const prefs = await guardarAvisos({
        reminderHour: nueva,
        avisaRacha: racha,
        avisaHito: hito,
        avisaHoraDificil: dificil,
      });
      if (prefs.error) {
        setError(prefs.error);
        return;
      }
      setHora(nueva);
    });
  }

  function apagar() {
    setError(null);
    startTransition(async () => {
      const endpoint = await desuscribirse();
      if (endpoint) await olvidarDispositivo(endpoint);
      // La hora a null es lo que apaga todo: la función que reparte los avisos
      // ni mira a quien la tiene vacía.
      await guardarAvisos({
        reminderHour: null,
        avisaRacha: racha,
        avisaHito: hito,
        avisaHoraDificil: dificil,
      });
      setHora(null);
    });
  }

  function actualizar(patch: Partial<{
    hora: number;
    racha: boolean;
    hito: boolean;
    dificil: boolean;
  }>) {
    const siguiente = {
      hora: patch.hora ?? hora ?? HORA_AVISO_POR_DEFECTO,
      racha: patch.racha ?? racha,
      hito: patch.hito ?? hito,
      dificil: patch.dificil ?? dificil,
    };
    setHora(siguiente.hora);
    setRacha(siguiente.racha);
    setHito(siguiente.hito);
    setDificil(siguiente.dificil);

    startTransition(async () => {
      const r = await guardarAvisos({
        reminderHour: siguiente.hora,
        avisaRacha: siguiente.racha,
        avisaHito: siguiente.hito,
        avisaHoraDificil: siguiente.dificil,
      });
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recordatorios"
        className="entrar relative flex max-h-[92dvh] w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card p-5 sm:rounded-[28px]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-[22px] font-semibold leading-none tracking-[-0.01em] text-label">
              Recordatorios
            </h2>
            <p className="text-[13.5px] leading-[1.4] text-label-2">
              Uno al día como mucho. Nunca para hacerte sentir mal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="pulsable -mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            <X size={17} weight="bold" aria-hidden="true" />
          </button>
        </div>

        {/* En iPhone esto va primero y es lo único que importa: sin instalar,
            no llega nada, y Safari no ofrece el botón. */}
        {entorno?.iphoneSuelto && (
          <div className="flex flex-col gap-2 rounded-[16px] bg-ambar/20 px-4 py-3.5">
            <span className="text-[15px] font-semibold text-label">
              Primero instala Antídoto
            </span>
            <p className="text-pretty text-[13.5px] leading-[1.45] text-label-2">
              En iPhone los avisos solo llegan si la app está en tu pantalla de
              inicio. Safari no lo ofrece solo, hay que hacerlo a mano:
            </p>
            <ol className="flex flex-col gap-1.5 text-[13.5px] leading-[1.4] text-label">
              <li className="flex items-center gap-2">
                <span className="tnum flex size-5 shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-bold">
                  1
                </span>
                Toca{" "}
                <Export size={16} weight="bold" aria-hidden="true" /> abajo en
                Safari
              </li>
              <li className="flex items-center gap-2">
                <span className="tnum flex size-5 shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-bold">
                  2
                </span>
                Baja y toca{" "}
                <Plus size={15} weight="bold" aria-hidden="true" /> Añadir a
                inicio
              </li>
              <li className="flex items-center gap-2">
                <span className="tnum flex size-5 shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-bold">
                  3
                </span>
                Abre Antídoto desde ahí y vuelve aquí
              </li>
            </ol>
          </div>
        )}

        {entorno && !entorno.soporta && !entorno.iphoneSuelto && (
          <p className="rounded-[16px] bg-fill px-4 py-3 text-pretty text-[13.5px] leading-[1.45] text-label-2">
            Este navegador no admite avisos. Prueba desde el teléfono con
            Chrome o Safari.
          </p>
        )}

        <button
          type="button"
          onClick={encendidos ? apagar : encender}
          disabled={pending || entorno?.iphoneSuelto || entorno?.soporta === false}
          className={`pulsable flex h-[54px] items-center justify-center gap-2 rounded-[16px] text-[16px] font-semibold tracking-[-0.01em] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
            encendidos ? "bg-fill text-label" : "bg-azul text-azul-tinta"
          }`}
        >
          {encendidos ? (
            <BellSlash size={19} weight="bold" aria-hidden="true" />
          ) : (
            <BellRinging size={19} weight="fill" aria-hidden="true" />
          )}
          {pending
            ? "Un momento…"
            : encendidos
              ? "Apagar los recordatorios"
              : "Encender recordatorios"}
        </button>

        {encendidos && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3">
                ¿A qué hora?
              </span>
              <div className="flex items-center gap-3 rounded-[16px] bg-fill px-4 py-3">
                <label className="sr-only" htmlFor="hora-aviso">
                  Hora del recordatorio
                </label>
                <select
                  id="hora-aviso"
                  value={hora ?? HORA_AVISO_POR_DEFECTO}
                  onChange={(e) => actualizar({ hora: Number(e.target.value) })}
                  className="tnum h-10 flex-1 rounded-xl bg-card px-3 text-[16px] text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
                <span className="shrink-0 text-[12.5px] text-label-2">
                  hora tuya
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3">
                Además
              </span>
              <div className="overflow-hidden rounded-[16px] bg-fill">
                <Interruptor
                  titulo="Tu hora difícil"
                  detalle="Un rato antes del momento en que suele darte, cuando ya hay patrón"
                  activo={dificil}
                  onChange={(v) => actualizar({ dificil: v })}
                />
                <div className="ml-4 h-px bg-separator" />
                <Interruptor
                  titulo="Racha en riesgo"
                  detalle="Tarde, solo si tienes algo que perder y sigue sin marcar"
                  activo={racha}
                  onChange={(v) => actualizar({ racha: v })}
                />
                <div className="ml-4 h-px bg-separator" />
                <Interruptor
                  titulo="Un hito a la vista"
                  detalle="La víspera de llegar a tu meta. Una sola vez"
                  activo={hito}
                  onChange={(v) => actualizar({ hito: v })}
                />
              </div>
            </div>

            <p className="text-[12px] leading-[1.4] text-label-3">
              Se activan en este dispositivo. Si entras desde otro, enciéndelos
              también ahí.
            </p>
          </>
        )}

        {error && (
          <p role="alert" className="text-[13px] leading-[1.4] text-rojo">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Interruptor({
  titulo,
  detalle,
  activo,
  onChange,
}: {
  titulo: string;
  detalle: string;
  activo: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onChange(!activo)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-azul"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[15px] font-medium tracking-[-0.01em] text-label">
          {titulo}
        </span>
        <span className="text-pretty text-[12.5px] leading-[1.35] text-label-2">
          {detalle}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`flex h-[30px] w-[50px] shrink-0 items-center rounded-full p-[3px] transition-colors ${
          activo ? "bg-menta" : "bg-separator"
        }`}
      >
        <span
          className={`size-6 rounded-full bg-card shadow-sm transition-transform ${
            activo ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}
