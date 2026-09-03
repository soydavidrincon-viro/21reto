"use client";

import { ArrowSquareOut, Plus, Trash, VideoCamera } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { addHabitVideo, deleteHabitVideo } from "@/app/actions/videos";
import { deDondeEs, type HabitVideo } from "@/lib/videos";

/**
 * Los videos que alguien eligió aplicar a un hábito que está construyendo.
 *
 * Solo aparece en los hábitos de tipo 'build', y la razón es que el trabajo es
 * distinto. En un hábito que se deja, el contador basta: la tarea es no hacerlo,
 * y ver el número subiendo es exactamente el apoyo que hace falta. En uno que se
 * empieza, el número no dice qué hacer — alguien que se puso "Ejercicio" abre la
 * app, ve nueve días y sigue sin saber cuál es la rutina de hoy. Esto es la
 * respuesta a esa pregunta, puesta por la misma persona en un momento en que sí
 * tenía ganas de buscarla.
 *
 * Los enlaces se abren en otra pestaña con `rel="noopener noreferrer"`: sin eso,
 * la página que se abre puede tocar la nuestra por `window.opener`.
 */
export function VideosDelHabito({
  habitId,
  videos,
}: {
  habitId: string;
  videos: HabitVideo[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await addHabitVideo(habitId, url, titulo);
      if (r.error) {
        setError(r.error);
        return;
      }
      setUrl("");
      setTitulo("");
      setAbierto(false);
    });
  }

  function borrar(id: string) {
    startTransition(async () => {
      const r = await deleteHabitVideo(id, habitId);
      if (r.error) setError(r.error);
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-[22px] bg-card px-4 py-4 lg:px-5 lg:py-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-label">
          Videos de este hábito
        </h2>
        {!abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="pulsable flex size-9 shrink-0 items-center justify-center rounded-full bg-azul text-azul-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            aria-label="Agregar un video"
          >
            <Plus size={18} weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>

      {videos.length === 0 && !abierto && (
        <p className="text-pretty text-[13.5px] leading-[1.45] text-label-2">
          Guarda aquí las rutinas, clases o videos que quieras seguir. El día que
          no sepas por dónde empezar, ya están elegidos.
        </p>
      )}

      {videos.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {videos.map((video) => (
            <li key={video.id} className="flex items-center gap-1">
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pulsable flex min-w-0 flex-1 items-center gap-3 rounded-[16px] bg-fill px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lila text-lila-tinta">
                  <VideoCamera size={19} weight="fill" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="truncate text-[15px] font-medium tracking-[-0.01em] text-label">
                    {video.title || deDondeEs(video.url)}
                  </span>
                  <span className="truncate text-[12px] text-label-3">
                    {video.title ? deDondeEs(video.url) : video.url}
                  </span>
                </span>
                <ArrowSquareOut
                  size={17}
                  weight="bold"
                  className="shrink-0 text-label-3"
                  aria-hidden="true"
                />
              </a>
              {/* Quitar un video no es destructivo de verdad —el video sigue
                  donde estaba, esto solo suelta el enlace— así que va en gris y
                  no en rojo, y sin confirmación. */}
              <button
                type="button"
                disabled={pending}
                onClick={() => borrar(video.id)}
                aria-label={`Quitar ${video.title || deDondeEs(video.url)}`}
                className="pulsable flex size-9 shrink-0 items-center justify-center rounded-full text-label-3 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
              >
                <Trash size={17} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <form onSubmit={guardar} className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="video-url">
            Enlace del video
          </label>
          <input
            id="video-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            // `url` y no `text`: en el teléfono cambia el teclado y aparecen la
            // barra y el punto sin tener que ir a la segunda capa.
            type="url"
            inputMode="url"
            autoComplete="off"
            required
            placeholder="Pega el enlace del video"
            className="h-[46px] rounded-[14px] bg-fill px-3.5 text-[15px] tracking-[-0.01em] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          />
          <label className="sr-only" htmlFor="video-titulo">
            Cómo llamarlo
          </label>
          <input
            id="video-titulo"
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            maxLength={120}
            placeholder="Cómo llamarlo (opcional)"
            className="h-[46px] rounded-[14px] bg-fill px-3.5 text-[15px] tracking-[-0.01em] text-label placeholder:text-label-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || url.trim() === ""}
              className="pulsable h-11 flex-1 rounded-[14px] bg-azul text-[15px] font-semibold text-azul-tinta disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setError(null);
              }}
              className="pulsable h-11 rounded-[14px] bg-fill px-4 text-[15px] font-semibold text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-[13px] leading-[1.35] text-rojo">
          {error}
        </p>
      )}
    </section>
  );
}
