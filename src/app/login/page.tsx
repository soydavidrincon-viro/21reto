"use client";

import { GoogleLogo } from "@phosphor-icons/react";
import { useState } from "react";
import { detectTimeZone } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";

/**
 * Dos formas de entrar, y el orden importa.
 *
 * Google va primero porque no manda ningún correo: la dirección ya viene
 * verificada, así que no depende del servidor de correo ni de que el mensaje
 * esquive la carpeta de spam.
 *
 * El enlace por correo se queda como alternativa y no como respaldo técnico.
 * Antídoto trackea alcohol, porno y apuestas; hay gente que no quiere eso atado
 * a su cuenta principal de Google, y quitarles la salida sería empujarlos a algo
 * que no querían o dejarlos fuera.
 *
 * Ninguna de las dos usa contraseña, así que no hay nada que olvidar ni que
 * recuperar: quien no puede entrar pide otro enlace.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  async function withGoogle() {
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setError("No pudimos abrir Google. Prueba con tu correo.");
      setShowEmail(true);
    }
  }

  async function withEmail(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { timezone: detectTimeZone() },
      },
    });

    if (error) {
      setError("No pudimos enviar el enlace. Revisa el correo e inténtalo otra vez.");
      setState("idle");
      return;
    }

    setState("sent");
  }

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-10"
      style={{ paddingTop: "max(env(safe-area-inset-top), 72px)" }}
    >
      <div className="flex flex-1 flex-col justify-center gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-[34px] font-bold leading-[1.08] tracking-[-0.026em] text-label">
            {state === "sent" ? "Revisa tu correo" : "Entra a Antídoto"}
          </h1>
          <p className="text-pretty text-[15px] leading-[1.4] tracking-[-0.01em] text-label-2">
            {state === "sent"
              ? `Te mandamos un enlace a ${email}. Ábrelo desde este mismo teléfono.`
              : "Sin contraseñas. Elige por dónde prefieres entrar."}
          </p>
        </div>

        {state !== "sent" && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={withGoogle}
              className="pulsable flex h-[54px] items-center justify-center gap-2.5 rounded-[16px] bg-label text-[17px] font-semibold tracking-[-0.02em] text-grouped focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              <GoogleLogo size={20} weight="bold" aria-hidden="true" />
              Continuar con Google
            </button>

            {showEmail ? (
              <form onSubmit={withEmail} className="flex flex-col gap-3">
                <label className="sr-only" htmlFor="email">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  inputMode="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-[50px] rounded-[14px] bg-card px-4 text-[17px] tracking-[-0.02em] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                />
                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="pulsable flex h-[54px] items-center justify-center rounded-[16px] bg-azul text-[17px] font-semibold tracking-[-0.02em] text-azul-tinta shadow-[0_8px_24px_-8px_var(--c-azul)] disabled:opacity-50 disabled:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                >
                  {state === "sending" ? "Enviando…" : "Enviarme el enlace"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className="flex h-11 items-center justify-center text-[15px] font-medium tracking-[-0.01em] text-azul focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
              >
                Prefiero un enlace a mi correo
              </button>
            )}

            {error && (
              <p role="alert" className="text-center text-[13px] leading-[1.35] text-rojo">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-[12px] leading-[1.4] text-label-2">
        Nadie más que tú ve lo que registras aquí.
      </p>
    </main>
  );
}
