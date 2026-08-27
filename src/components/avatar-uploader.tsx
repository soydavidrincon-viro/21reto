"use client";

import { Camera, Trash } from "@phosphor-icons/react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { setAvatar } from "@/app/actions/profile";
import { createClient } from "@/lib/supabase/client";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const LADO = 512;

/**
 * Foto de perfil.
 *
 * Se recorta y encoge en el navegador antes de subir: una foto de iPhone pesa
 * 4 MB y se va a mostrar en un círculo de 80px, así que subirla entera gasta
 * los datos de la persona y el almacenamiento para nada. Después del recorte
 * queda en unos 60 KB.
 */
async function encoger(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const lado = Math.min(bitmap.width, bitmap.height);

  const lienzo = document.createElement("canvas");
  lienzo.width = LADO;
  lienzo.height = LADO;

  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("sin canvas");

  // Recorte cuadrado desde el centro: es como se va a ver en el círculo.
  ctx.drawImage(
    bitmap,
    (bitmap.width - lado) / 2,
    (bitmap.height - lado) / 2,
    lado,
    lado,
    0,
    0,
    LADO,
    LADO,
  );
  bitmap.close();

  return new Promise((resolve, reject) => {
    lienzo.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("sin blob"))),
      "image/webp",
      0.86,
    );
  });
}

export function AvatarUploader({
  userId,
  actual,
  nombre,
}: {
  userId: string;
  actual: string | null;
  nombre: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(actual);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [pending, startTransition] = useTransition();

  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";

  async function elegir(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;

    setError(null);

    if (!TIPOS.includes(archivo.type)) {
      setError("Tiene que ser JPG, PNG o WebP.");
      return;
    }
    if (archivo.size > MAX_BYTES) {
      setError("La imagen no puede pasar de 5 MB.");
      return;
    }

    setSubiendo(true);
    try {
      const pequena = await encoger(archivo);
      const supabase = createClient();
      // El nombre lleva la hora para que el navegador no sirva la foto vieja
      // desde su caché al cambiarla.
      const ruta = `${userId}/${Date.now()}.webp`;

      const { error: falla } = await supabase.storage
        .from("avatares")
        .upload(ruta, pequena, { contentType: "image/webp", upsert: true });

      if (falla) throw falla;

      const { data } = supabase.storage.from("avatares").getPublicUrl(ruta);
      setUrl(data.publicUrl);
      startTransition(() => {
        void setAvatar(data.publicUrl);
      });
    } catch {
      setError("No pudimos subir la imagen. Inténtalo otra vez.");
    } finally {
      setSubiendo(false);
    }
  }

  function quitar() {
    setUrl(null);
    startTransition(() => {
      void setAvatar(null);
    });
  }

  return (
    <div className="flex items-center gap-4">
      <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-azul">
        {url ? (
          <Image
            src={url}
            alt=""
            width={80}
            height={80}
            unoptimized
            className="size-full object-cover"
          />
        ) : (
          <span className="font-display text-[30px] font-semibold text-azul-tinta">
            {inicial}
          </span>
        )}
      </span>

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={subiendo || pending}
            className="pulsable flex h-10 items-center gap-1.5 rounded-xl bg-fill px-3.5 text-[14px] font-semibold text-label disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            <Camera size={17} weight="fill" aria-hidden="true" />
            {subiendo ? "Subiendo…" : url ? "Cambiar" : "Subir foto"}
          </button>

          {url && (
            <button
              type="button"
              onClick={quitar}
              disabled={subiendo || pending}
              aria-label="Quitar la foto"
              className="pulsable flex size-10 items-center justify-center rounded-xl bg-fill text-label-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              <Trash size={17} aria-hidden="true" />
            </button>
          )}
        </div>

        <span className="text-[12px] text-label-2">
          {error ?? "JPG, PNG o WebP. Hasta 5 MB."}
        </span>
      </div>

      <input
        ref={input}
        type="file"
        accept={TIPOS.join(",")}
        onChange={elegir}
        className="sr-only"
        aria-label="Elegir foto de perfil"
      />
    </div>
  );
}
