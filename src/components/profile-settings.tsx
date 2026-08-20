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

  function fixZone() {
    startTransition(async () => {
      const result = await updateProfile({ timezone: browserZone });
      setMessage(result.error ?? `Zona horaria cambiada a ${browserZone}`);
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
            className="h-[50px] flex-1 rounded-2xl bg-card px-4 text-[17px] tracking-[-0.02em] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
            placeholder="Tu nombre"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={pending || name.trim() === (profile.display_name ?? "")}
            className="h-[50px] rounded-2xl bg-blue px-5 text-[15px] font-semibold text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
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
              className={`flex h-[38px] w-full items-center justify-center rounded-[7px] text-[14px] tracking-[-0.01em] text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${
                theme === option.key ? "bg-card font-semibold shadow-sm" : "font-medium"
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
        <div className="mx-4 flex flex-col gap-2 rounded-2xl bg-card px-4 py-3.5">
          <p className="text-[17px] tracking-[-0.02em] text-label">{profile.timezone}</p>
          <p className="text-pretty text-[13px] leading-[1.4] text-label-2">
            De aquí sale a qué día pertenece cada check. Si está mal, marcar de
            noche caería en el día siguiente.
          </p>
          {zoneMismatch && (
            <button
              type="button"
              onClick={fixZone}
              disabled={pending}
              className="self-start text-[15px] font-medium text-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
            >
              Cambiar a la de este dispositivo ({browserZone})
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
            className="w-full px-4 py-3.5 text-left text-[17px] tracking-[-0.02em] text-blue focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue"
          >
            Descargar todo en JSON
          </button>
          <div className="ml-4 h-px bg-separator" />
          <button
            type="button"
            onClick={() => startTransition(() => signOut())}
            disabled={pending}
            className="w-full px-4 py-3.5 text-left text-[17px] tracking-[-0.02em] text-blue focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue"
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
                className="h-11 rounded-xl bg-fill px-3 text-[17px] tracking-[-0.02em] text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
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
                  className="h-11 flex-1 rounded-xl bg-red text-[15px] font-semibold text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
                >
                  Eliminar definitivamente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDanger(false);
                    setConfirmText("");
                  }}
                  className="h-11 flex-1 rounded-xl bg-fill text-[15px] font-semibold text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setDanger(true)}
              className="self-start text-[15px] font-medium text-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
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
