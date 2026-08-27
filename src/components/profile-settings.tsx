"use client";

import { useState, useTransition } from "react";
import {
  deleteAccount,
  exportData,
  setTheme,
  signOut,
  updateProfile,
  type Theme,
} from "@/app/actions/profile";
import { detectTimeZone } from "@/lib/dates";
import type { Profile } from "@/lib/types";

/**
 * Todas las zonas horarias que conoce el navegador. Se pide una sola vez porque
 * la lista pasa de 400 entradas y recalcularla en cada render es gratis de
 * escribir y caro de correr. El fallback cubre navegadores viejos sin
 * supportedValuesOf, donde al menos queda la del dispositivo.
 */
const ZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [detectTimeZone(), "UTC"];
  }
})();

const THEMES: { key: Theme; label: string }[] = [
  { key: "system", label: "Sistema" },
  { key: "light", label: "Claro" },
  { key: "dark", label: "Oscuro" },
];

export function ProfileSettings({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.display_name ?? "");
  const [theme, setThemeState] = useState<Theme>(profile.theme);
  const [confirmText, setConfirmText] = useState("");
  const [danger, setDanger] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const browserZone = detectTimeZone();
  const zoneMismatch = browserZone !== profile.timezone;

  function saveName() {
    startTransition(async () => {
      const result = await updateProfile({ display_name: name.trim() });
      setMessage(result.error ?? "Nombre guardado");
    });
  }

  function pickTheme(next: Theme) {
    setThemeState(next);
    startTransition(async () => {
      await setTheme(next);
    });
  }

  function pickZone(zone: string) {
    startTransition(async () => {
      const result = await updateProfile({ timezone: zone });
      setMessage(result.error ?? `Zona horaria: ${zone.replace(/_/g, " ")}`);
    });
  }

  function download() {
    startTransition(async () => {
      const result = await exportData();
      if (result.error || !result.data) {
        setMessage(result.error ?? "No pudimos armar el archivo.");
        return;
      }

      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `antidoto-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-[7px]">
        <label
          htmlFor="nombre"
          className="px-8 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2"
        >
          Cómo te llamamos
        </label>
        <div className="mx-4 flex gap-2">
          <input
            id="nombre"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            className="h-[50px] flex-1 rounded-2xl bg-card px-4 text-[17px] tracking-[-0.02em] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            placeholder="Tu nombre"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={pending || name.trim() === (profile.display_name ?? "")}
            className="h-[50px] rounded-2xl bg-azul px-5 text-[15px] font-semibold text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            Guardar
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-[7px]">
        <span className="px-8 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
          Apariencia
        </span>
        <div
          role="radiogroup"
          aria-label="Tema"
          className="mx-4 flex gap-0.5 rounded-[9px] bg-fill p-0.5"
        >
          {THEMES.map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={theme === option.key}
              onClick={() => pickTheme(option.key)}
              className={`flex h-[38px] w-full items-center justify-center rounded-[7px] text-[14px] font-medium tracking-[-0.01em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                theme === option.key
                  ? "bg-segment text-label shadow-sm"
                  : "text-label-2"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-[7px]">
        <span className="px-8 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
          Zona horaria
        </span>
        <div className="mx-4 flex flex-col gap-2.5 rounded-2xl bg-card px-4 py-3.5">
          <label className="sr-only" htmlFor="zona">
            Zona horaria
          </label>
          <select
            id="zona"
            value={profile.timezone}
            disabled={pending}
            onChange={(event) => pickZone(event.target.value)}
            className="h-11 rounded-xl bg-fill px-3 text-[17px] tracking-[-0.02em] text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            {ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <p className="text-pretty text-[13px] leading-[1.4] text-label-2">
            De aquí sale a qué día pertenece cada check. Si está mal, marcar de
            noche caería en el día siguiente.
          </p>
          {zoneMismatch && (
            <button
              type="button"
              onClick={() => pickZone(browserZone)}
              disabled={pending}
              className="self-start text-[15px] font-medium text-azul focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Usar la de este dispositivo ({browserZone.replace(/_/g, " ")})
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-[7px]">
        <span className="px-8 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
          Tus datos
        </span>
        <div className="mx-4 overflow-hidden rounded-2xl bg-card">
          <button
            type="button"
            onClick={download}
            disabled={pending}
            className="w-full px-4 py-3.5 text-left text-[17px] tracking-[-0.02em] text-azul focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-azul"
          >
            Descargar todo en JSON
          </button>
          <div className="ml-4 h-px bg-separator" />
          <button
            type="button"
            onClick={() => startTransition(() => signOut())}
            disabled={pending}
            className="w-full px-4 py-3.5 text-left text-[17px] tracking-[-0.02em] text-azul focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-azul"
          >
            Cerrar sesión
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-[7px]">
        <span className="px-8 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
          Eliminar la cuenta
        </span>
        <div className="mx-4 flex flex-col gap-3 rounded-2xl bg-card px-4 py-3.5">
          <p className="text-pretty text-[13px] leading-[1.4] text-label-2">
            Borra tu perfil, tus hábitos, todos los registros y la bitácora
            entera. No se puede deshacer y no guardamos copia. Si quieres
            conservar algo, descárgalo antes.
          </p>

          {danger ? (
            <>
              <label htmlFor="confirmar" className="text-[13px] text-label">
                Escribe <b>ELIMINAR</b> para confirmar
              </label>
              <input
                id="confirmar"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                className="h-11 rounded-xl bg-fill px-3 text-[17px] tracking-[-0.02em] text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending || confirmText !== "ELIMINAR"}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteAccount();
                      if (result?.error) setMessage(result.error);
                    })
                  }
                  className="h-11 flex-1 rounded-xl bg-red-500 text-[15px] font-semibold text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                >
                  Eliminar definitivamente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDanger(false);
                    setConfirmText("");
                  }}
                  className="h-11 flex-1 rounded-xl bg-fill text-[15px] font-semibold text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setDanger(true)}
              className="self-start text-[15px] font-medium text-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Eliminar mi cuenta
            </button>
          )}
        </div>
      </section>

      <p aria-live="polite" className="px-5 text-center text-[13px] text-label-2">
        {message}
      </p>
    </div>
  );
}
