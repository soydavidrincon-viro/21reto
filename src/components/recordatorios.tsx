"use client";

import { Portal, useHojaModal } from "@/components/portal";

import { Bell, BellRinging, BellSlash, X } from "@phosphor-icons/react";
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
import { PasosDeInstalacion } from "@/components/pasos-de-instalacion";
import { HORA_AVISO_MANANA, HORA_AVISO_NOCHE, type Profile } from "@/lib/types";

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
          className="pulsable relative flex size-11 shrink-0 items-center justify-center rounded-full text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          {encendidos ? (
            <>
              <BellRinging
                size={21}
                weight="fill"
                className="text-azul"
                aria-hidden="true"
              />
              {/* Un punto en vez de un número: no hay nada que contar, solo
                  que están puestos. */}
              <span
                aria-hidden="true"
                className="absolute right-2.5 top-2.5 size-[7px] rounded-full bg-menta ring-2 ring-grouped"
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
              ? `A las ${HORA_AVISO_MANANA} y a las ${HORA_AVISO_NOCHE}, hora tuya`
              : "Apagados"}
          </span>
        </span>
      </button>
      {abierta && <Hoja profile={profile} onClose={() => setAbierta(false)} />}
    </>
  );
}

function Hoja({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  // `reminder_hour` es solo el interruptor: nulo es apagados. Las horas son
  // fijas (9 y 21) desde 0013, así que aquí no se elige nada.
  const [encendidos, setEncendidos] = useState(profile.reminder_hour !== null);
  const [hito, setHito] = useState(profile.avisa_hito);
  const [dificil, setDificil] = useState(profile.avisa_hora_dificil);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hoja = useHojaModal(onClose);

  // Qué puede hacer este navegador. Va por useSyncExternalStore y no por un
  // efecto que llame a setState: en el servidor estas APIs no existen, así que
  // la primera pintada tiene que decir "todavía no sé" y la segunda ya el
  // valor real. Es exactamente para lo que sirve el snapshot de servidor.
  const entorno = useSyncExternalStore(sinCambios, leerEntorno, () => null);

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

      const prefs = await guardarAvisos({
        encendidos: true,
        avisaHito: hito,
        avisaHoraDificil: dificil,
      });
      if (prefs.error) {
        setError(prefs.error);
        return;
      }
      setEncendidos(true);
    });
  }

  function apagar() {
    setError(null);
    startTransition(async () => {
      const endpoint = await desuscribirse();
      if (endpoint) await olvidarDispositivo(endpoint);
      // Apagar es dejar el interruptor en nulo: la función que reparte los
      // avisos ni mira a quien lo tiene vacío.
      await guardarAvisos({
        encendidos: false,
        avisaHito: hito,
        avisaHoraDificil: dificil,
      });
      setEncendidos(false);
    });
  }

  function actualizar(patch: Partial<{ hito: boolean; dificil: boolean }>) {
    const siguiente = {
      hito: patch.hito ?? hito,
      dificil: patch.dificil ?? dificil,
    };
    setHito(siguiente.hito);
    setDificil(siguiente.dificil);

    startTransition(async () => {
      const r = await guardarAvisos({
        encendidos: true,
        avisaHito: siguiente.hito,
        avisaHoraDificil: siguiente.dificil,
      });
      if (r.error) setError(r.error);
    });
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
          aria-label="Recordatorios"
          className="entrar relative flex max-h-[92dvh] w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card p-5 outline-none sm:rounded-[28px]"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-[22px] font-semibold leading-none tracking-[-0.01em] text-label">
                Recordatorios
              </h2>
              <p className="tnum text-[13.5px] leading-[1.4] text-label-2">
                Dos al día: a las {HORA_AVISO_MANANA} para recordarte el reto y a
                las {HORA_AVISO_NOCHE} para que marques antes de medianoche. Hora
                tuya.
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

          {/* En iPhone esto va primero y es lo único que importa: sin instalar,
            no llega nada, y Safari no ofrece el botón. */}
          {entorno?.iphoneSuelto && (
            <div className="flex flex-col gap-2 rounded-[16px] bg-ambar/20 px-4 py-3.5">
              <span className="text-[15px] font-semibold text-label">
                Primero instala Antídoto
              </span>
              <p className="text-pretty text-[13.5px] leading-[1.45] text-label-2">
                En iPhone los avisos solo llegan si la app está en tu pantalla
                de inicio. Safari no lo ofrece solo, hay que hacerlo a mano:
              </p>
              <PasosDeInstalacion ultimo="Abre Antídoto desde ahí y vuelve aquí" />
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
            disabled={
              pending || entorno?.iphoneSuelto || entorno?.soporta === false
            }
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
              <div className="tnum flex flex-col gap-1 rounded-[16px] bg-fill px-4 py-3 text-[13.5px] leading-[1.45] text-label-2">
                <span>
                  <b className="font-semibold text-label">{HORA_AVISO_MANANA}:00</b>{" "}
                  Cuántos días llevas y por qué lo haces.
                </span>
                <span>
                  <b className="font-semibold text-label">{HORA_AVISO_NOCHE}:00</b>{" "}
                  Si falta algo por marcar, te lo dice antes de que el reto
                  vuelva a cero. Si ya marcaste, te pide la bitácora.
                </span>
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
                    titulo="Un hito a la vista"
                    detalle="La víspera de llegar a tu meta. Una sola vez"
                    activo={hito}
                    onChange={(v) => actualizar({ hito: v })}
                  />
                </div>
              </div>

              <p className="text-[12px] leading-[1.4] text-label-3">
                Se activan en este dispositivo. Si entras desde otro,
                enciéndelos también ahí.
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
    </Portal>
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
