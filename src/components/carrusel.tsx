"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El envoltorio del carrusel: el contenedor con arrastre y los puntos debajo.
 *
 * Las tarjetas llegan como `children` ya pintadas en el servidor; aquí solo
 * se escucha el scroll para saber cuál está a la vista. Sin esto, con dos
 * retos nada decía que hubiera un segundo: la tarjeta ocupaba el ancho entero
 * y el texto "desliza" de debajo se leía como decoración. Ahora la siguiente
 * asoma por el borde (`w-[86%]` lo decide quien pinta las tarjetas) y los
 * puntos dicen cuántas hay y en cuál estás.
 *
 * Con una sola tarjeta no hay puntos: un punto solo es un manchón.
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

  return (
    <div className="flex flex-col gap-2.5">
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 lg:px-0"
        style={{ scrollbarWidth: "none" }}
        aria-label={etiqueta}
      >
        {children}
      </div>

      {total > 1 && (
        <div
          className="flex items-center justify-center gap-1.5"
          role="status"
          aria-label={`Reto ${activa + 1} de ${total}`}
        >
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === activa ? "w-4 bg-label" : "w-1.5 bg-label-3/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
