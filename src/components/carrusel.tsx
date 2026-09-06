"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

/**
 * El envoltorio del carrusel: el contenedor con arrastre, las flechas y los
 * puntos debajo.
 *
 * Las tarjetas llegan como `children` ya pintadas en el servidor; aquí solo
 * se escucha el scroll para saber cuál está a la vista. Sin esto, con dos
 * retos nada decía que hubiera un segundo: la tarjeta ocupaba el ancho entero
 * y el texto "desliza" de debajo se leía como decoración. Ahora la siguiente
 * asoma por el borde (`w-[86%]` lo decide quien pinta las tarjetas) y los
 * puntos dicen cuántas hay y en cuál estás.
 *
 * En computadora no hay dedo con que deslizar y la barra de scroll va oculta,
 * así que con dos retos solo se veía el primero. Por eso las flechas: salen
 * desde `lg:` y se esconden en el teléfono, donde taparían el número grande.
 * Los puntos también se tocan, y las flechas del teclado funcionan con el
 * carrusel enfocado.
 *
 * Con una sola tarjeta no hay flechas ni puntos: un punto solo es un manchón.
 */
export function Carrusel({
  total,
  etiqueta,
  children,
}: {
  total: number;
  etiqueta: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [activa, setActiva] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || total < 2) return;

    let marco = 0;
    function alDesplazar() {
      cancelAnimationFrame(marco);
      marco = requestAnimationFrame(() => {
        if (!el) return;
        // La tarjeta cuyo centro queda más cerca del centro visible.
        const centro = el.scrollLeft + el.clientWidth / 2;
        let mejor = 0;
        let distancia = Infinity;
        Array.from(el.children).forEach((hijo, i) => {
          const h = hijo as HTMLElement;
          const d = Math.abs(h.offsetLeft + h.offsetWidth / 2 - centro);
          if (d < distancia) {
            distancia = d;
            mejor = i;
          }
        });
        setActiva(mejor);
      });
    }

    el.addEventListener("scroll", alDesplazar, { passive: true });
    return () => {
      el.removeEventListener("scroll", alDesplazar);
      cancelAnimationFrame(marco);
    };
  }, [total]);

  /** Lleva la tarjeta `i` a la vista. El listener de scroll marca el punto. */
  function irA(i: number) {
    const el = ref.current;
    if (!el) return;
    const destino = Math.max(0, Math.min(total - 1, i));
    const hijo = el.children[destino] as HTMLElement | undefined;
    if (!hijo) return;
    el.scrollTo({ left: hijo.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }

  function alTeclear(evento: React.KeyboardEvent<HTMLDivElement>) {
    if (total < 2) return;
    if (evento.key === "ArrowRight") {
      evento.preventDefault();
      irA(activa + 1);
    } else if (evento.key === "ArrowLeft") {
      evento.preventDefault();
      irA(activa - 1);
    }
  }

  const flecha =
    "pulsable absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-card text-label shadow-[0_4px_16px_-4px_rgba(0,0,0,0.25)] disabled:opacity-30 disabled:shadow-none lg:flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul";

  return (
    <div className="relative flex flex-col gap-2.5">
      <div
        ref={ref}
        tabIndex={total > 1 ? 0 : -1}
        onKeyDown={alTeclear}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul lg:px-0"
        style={{ scrollbarWidth: "none" }}
        aria-label={etiqueta}
      >
        {children}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => irA(activa - 1)}
            disabled={activa === 0}
            aria-label="Reto anterior"
            className={`${flecha} left-1`}
          >
            <CaretLeft size={18} weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => irA(activa + 1)}
            disabled={activa === total - 1}
            aria-label="Reto siguiente"
            className={`${flecha} right-1`}
          >
            <CaretRight size={18} weight="bold" aria-hidden="true" />
          </button>

          <div
            className="flex items-center justify-center"
            role="group"
            aria-label={`Reto ${activa + 1} de ${total}`}
          >
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => irA(i)}
                aria-label={`Ir al reto ${i + 1}`}
                aria-current={i === activa ? "true" : undefined}
                className="flex h-11 items-center px-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
              >
                <span
                  aria-hidden="true"
                  className={`block h-1.5 rounded-full transition-all duration-200 ${
                    i === activa ? "w-4 bg-label" : "w-1.5 bg-label-3/60"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
