"use client";

import { useState } from "react";
import { detectTimeZone } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";

/**
 * Entrada por magic link: sin contraseñas que recordar ni recuperar. La zona
 * horaria detectada viaja en los metadatos para sembrar el perfil apenas se
 * cree la cuenta.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
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
              : "Te enviamos un enlace por correo. Sin contraseñas."}
          </p>
        </div>

        {state !== "sent" && (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="sr-only" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-[50px] rounded-[14px] bg-card px-4 text-[17px] tracking-[-0.02em] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
            />

            {error && (
              <p role="alert" className="text-[13px] leading-[1.35] text-red">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={state === "sending"}
              className="flex h-[50px] items-center justify-center rounded-[14px] bg-blue text-[17px] font-semibold tracking-[-0.02em] text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
            >
              {state === "sending" ? "Enviando…" : "Enviarme el enlace"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
