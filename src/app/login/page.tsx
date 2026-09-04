"use client";

import { GoogleLogo, PaperPlaneTilt } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { detectTimeZone } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { COOKIE_DESTINO, destinoSeguro } from "@/lib/supabase/destino";

/**
 * Guarda a dónde volver después de entrar, si el proxy lo dijo.
 *
 * Se lee de `window.location` al tocar el botón y no con `useSearchParams`:
 * eso obligaría a envolver la página en Suspense para poder prerenderizarla,
 * y la razón de que esta página sea estática es que cargue rápido en frío.
 * Diez minutos bastan para abrir el correo; si se pasa, se cae a Hoy y ya.
 */
function recordarDestino() {
  const next = new URLSearchParams(window.location.search).get("next");
  const destino = destinoSeguro(next);
  if (destino === "/hoy") return;
  // Sin codificar: `destinoSeguro` ya garantiza que solo lleva caracteres de
  // ruta, y la ruta de retorno lo lee tal cual.
  document.cookie = `${COOKIE_DESTINO}=${destino}; path=/; max-age=600; samesite=lax`;
}

/**
 * Dos formas de entrar, y las dos a la vista.
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
 * El formulario ya no vive detrás de un botón "prefiero un enlace a mi correo".
 * Ese botón solo hacía algo si el JavaScript había hidratado, así que cualquier
 * fallo de carga dejaba la pantalla entera muerta: se veía bien y no respondía a
 * nada. Ahora el campo está desde el primer pintado y lo único que necesita JS
 * es el envío.
 *
 * Ninguna de las dos usa contraseña, así que no hay nada que olvidar ni que
 * recuperar: quien no puede entrar pide otro enlace.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  /**
   * "Esto está tardando". Aparece a los seis segundos de tocar cualquiera de
   * los dos botones.
   *
   * Está aquí porque pasó: el proyecto de Supabase se enfrió y las peticiones
   * de auth tardaban veinte segundos. El botón se quedaba mudo, sin girar ni
   * decir nada, y desde fuera eso no se distingue de un botón roto — la gente
   * lo toca otra vez, recarga, y se va.
   */
  const [lento, setLento] = useState(false);

  function empiezaAlgo() {
    setLento(false);
    const t = setTimeout(() => setLento(true), 6000);
    return () => clearTimeout(t);
  }

  async function withGoogle() {
    setError(null);
    const listo = empiezaAlgo();
    recordarDestino();
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });

    listo();
    if (error) {
      setLento(false);
      setError("No pudimos abrir Google. Usa tu correo aquí abajo.");
    }
  }

  async function withEmail(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);
    const listo = empiezaAlgo();
    recordarDestino();

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { timezone: detectTimeZone() },
      },
    });

    listo();
    setLento(false);

    if (error) {
      setError(
        "No pudimos enviar el enlace. Revisa el correo e inténtalo otra vez.",
      );
      setState("idle");
      return;
    }

    setState("sent");
  }

  return (
    <main
      // min-h-svh y no dvh: `dvh` cambia cuando se abre el teclado y cuando la
      // barra del navegador se esconde. Con el contenido centrado, eso movía el
      // campo de correo 176px de golpe justo al tocarlo — medido — y en el
      // teléfono eso es que el dedo cae en otra parte, se cierra el teclado y
      // toca empezar de nuevo. `svh` es el valor estable: no se mueve.
      className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col px-6 pb-10 lg:max-w-[980px] lg:px-10"
      style={{ paddingTop: "max(env(safe-area-inset-top), 40px)" }}
    >
      <Link
        href="/"
        className="flex justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul lg:justify-start"
      >
        <Logo size={26} />
      </Link>

      {/* En teléfono el bloque va arriba y no centrado: centrado, cualquier
          cambio de alto lo reacomoda entero. En escritorio no hay teclado que
          empuje nada, así que ahí sí se centra. */}
      <div className="flex flex-1 flex-col gap-7 pt-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:pt-0">
        <div className="flex flex-col gap-2 lg:gap-4">
          <h1 className="text-balance font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] text-label lg:text-[48px]">
            {state === "sent" ? "Revisa tu correo" : "Entra a Antídoto"}
          </h1>
          <p className="text-pretty text-[15px] leading-[1.45] tracking-[-0.01em] text-label-2 lg:text-[18px]">
            {state === "sent"
              ? `Te mandamos un enlace a ${email}. Ábrelo desde este mismo dispositivo.`
              : "Sin contraseñas: ni que crear ni que olvidar. Elige por dónde prefieres entrar."}
          </p>
        </div>

        {/* Sin animación de entrada, a propósito.
            Este bloque lleva el campo de correo, y con `entrar` el campo pasaba
            los primeros 650ms invisible y después deslizándose 14px hacia
            arriba — o sea que durante ese rato es tocable pero se está
            moviendo, y en un teléfono un toque sobre algo que se mueve puede no
            contar como toque sobre eso. Ninguna animación vale un campo de
            texto que a veces no responde. */}
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

            <span className="flex items-center gap-3 py-0.5 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-label-3">
              <span className="h-px flex-1 bg-separator" />o
              <span className="h-px flex-1 bg-separator" />
            </span>

            <form onSubmit={withEmail} className="flex flex-col gap-2.5">
              <label
                htmlFor="email"
                className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3"
              >
                Un enlace a tu correo
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
                className="h-[52px] rounded-[14px] bg-card px-4 text-[17px] tracking-[-0.02em] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className="pulsable flex h-[54px] items-center justify-center gap-2 rounded-[16px] bg-azul text-[17px] font-semibold tracking-[-0.02em] text-azul-tinta shadow-[0_8px_24px_-8px_var(--c-azul)] disabled:opacity-50 disabled:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
              >
                <PaperPlaneTilt size={18} weight="fill" aria-hidden="true" />
                {state === "sending" ? "Enviando…" : "Enviarme el enlace"}
              </button>
            </form>

            {lento && !error && (
              <p
                aria-live="polite"
                className="text-pretty rounded-xl bg-fill px-3.5 py-2.5 text-center text-[13px] leading-[1.4] text-label-2"
              >
                Esto está tardando más de lo normal. Es el servidor, no tú —
                espera un momento o vuelve a intentarlo en un minuto.
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="text-center text-[13px] leading-[1.35] text-rojo"
              >
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
