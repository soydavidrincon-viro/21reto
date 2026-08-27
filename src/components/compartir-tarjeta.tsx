"use client";

import { Export, EyeSlash } from "@phosphor-icons/react";
import { useState } from "react";

/**
 * Compartir el progreso como imagen.
 *
 * El interruptor de "sin decir de qué" va antes del botón y no escondido en
 * ajustes: alguien que trackea porno, apuestas o pastillas tiene que verlo
 * antes de compartir, no descubrirlo después. Por eso tampoco viene marcado
 * por defecto en un sentido ni en el otro — lo decide quien comparte, mirándolo.
 *
 * La imagen se pide al servidor y se pasa al menú nativo del teléfono. Donde no
 * exista ese menú —escritorio, navegadores viejos— se descarga, que hace lo
 * mismo con un paso más.
 */
export function CompartirTarjeta({
  habitId,
  nombre,
}: {
  habitId: string;
  nombre: string;
}) {
  const [conNombre, setConNombre] = useState(true);
  const [estado, setEstado] = useState<"idle" | "armando" | "error">("idle");

  async function compartir() {
    setEstado("armando");
    try {
      const respuesta = await fetch(
        `/api/tarjeta/${habitId}?nombre=${conNombre ? "1" : "0"}`,
      );
      if (!respuesta.ok) throw new Error("no se pudo");

      const blob = await respuesta.blob();
      const archivo = new File([blob], "antidoto.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo] });
        setEstado("idle");
        return;
      }

      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "antidoto.png";
      enlace.click();
      URL.revokeObjectURL(url);
      setEstado("idle");
    } catch (fallo) {
      // Cerrar el menú nativo de compartir lanza AbortError. Eso no es un
      // error: es alguien que se arrepintió, y decirle que algo falló sería
      // mentirle.
      if (fallo instanceof DOMException && fallo.name === "AbortError") {
        setEstado("idle");
        return;
      }
      setEstado("error");
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[22px] bg-card px-4 py-3.5 lg:px-5 lg:py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-label">
          Compartir tu progreso
        </h2>
        <span className="text-[12px] text-label-3">Se ve como una imagen</span>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-fill px-3 py-2.5">
        <input
          type="checkbox"
          checked={!conNombre}
          onChange={(event) => setConNombre(!event.target.checked)}
          className="size-[18px] shrink-0 accent-[var(--c-azul)]"
        />
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13.5px] leading-[1.35] text-label">
          <EyeSlash size={16} aria-hidden="true" className="shrink-0" />
          Sin decir de qué
        </span>
      </label>

      <p className="text-[12.5px] leading-[1.4] text-label-2">
        {conNombre
          ? `La imagen va a decir "días sin ${nombre.toLowerCase()}".`
          : "La imagen va a decir solo “días limpios”."}
      </p>

      <button
        type="button"
        onClick={compartir}
        disabled={estado === "armando"}
        className="pulsable flex h-12 items-center justify-center gap-2 rounded-xl bg-azul text-[15px] font-semibold text-azul-tinta disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
      >
        <Export size={18} weight="bold" aria-hidden="true" />
        {estado === "armando" ? "Armando la imagen…" : "Compartir"}
      </button>

      {estado === "error" && (
        <p role="alert" className="text-[13px] text-rojo">
          No pudimos armar la imagen. Inténtalo otra vez.
        </p>
      )}
    </div>
  );
}
