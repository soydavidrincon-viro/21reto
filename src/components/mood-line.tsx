import { MOOD_BY_KEY } from "@/lib/types";

type Point = { date: string; label: string; mood: string | null };

/**
 * Línea de ánimo de los últimos siete días. Serie única, sin leyenda: el título
 * de la sección ya dice qué es. Los días sin entrada cortan la línea en vez de
 * interpolarse — inventar un punto sería afirmar algo que la persona no dijo.
 */
export function MoodLine({ points }: { points: Point[] }) {
  const width = 322;
  const height = 96;
  const top = 12;
  const bottom = 84;

  const coords = points.map((point, i) => {
    const score = point.mood
      ? (MOOD_BY_KEY.get(point.mood)?.score ?? null)
      : null;
    // El punto se centra en su columna, igual que la cara de abajo. Repartirlos
    // de borde a borde los desalineaba de la fila de caras, que sí es una
    // rejilla de columnas iguales, y la gráfica parecía corrida medio día.
    const x = (width * (i + 0.5)) / points.length;
    const y =
      score === null ? null : bottom - ((score - 1) / 4) * (bottom - top);
    return { ...point, score, x, y };
  });

  // Cada tramo continuo es su propio path: así un hueco se ve como hueco.
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const point of coords) {
    if (point.y === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push({ x: point.x, y: point.y });
    }
  }
  if (current.length) segments.push(current);

  const filled = coords.filter((point) => point.y !== null);
  const last = filled.at(-1);

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-24 w-full"
        role="img"
        aria-label={`Ánimo de los últimos ${points.length} días`}
      >
        {[top, (top + bottom) / 2, bottom].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2={width}
            y2={y}
            className="stroke-separator"
            strokeWidth="1"
            opacity="0.5"
          />
        ))}

        {segments.map((segment, i) => (
          <polyline
            key={i}
            points={segment.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            className="stroke-azul"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Sin <title> aquí dentro: React 19 trata cualquier <title> como
            metadato del documento y lo iza al <head>, así que el servidor
            mandaba <title></title> vacío y el cliente lo rellenaba al hidratar
            — mismatch de hidratación en cada carga. El texto del punto vive
            abajo, en la fila de caras. */}
        {filled.map((point) => (
          <circle
            key={point.date}
            cx={point.x}
            cy={point.y!}
            r={point.date === last?.date ? 5 : 4}
            className="fill-azul stroke-card"
            strokeWidth="2"
          />
        ))}
      </svg>

      <ol
        className="grid text-center"
        style={{
          gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
        }}
      >
        {points.map((point) => {
          const mood = point.mood ? MOOD_BY_KEY.get(point.mood) : null;
          return (
            <li
              key={point.date}
              className="flex flex-col items-center gap-0.5"
              title={
                mood
                  ? `${point.label}: ${mood.label}`
                  : `${point.label}: sin registro`
              }
            >
              <span className="text-[17px] leading-none">
                {mood ? (
                  <span aria-label={mood.label}>{mood.emoji}</span>
                ) : (
                  <span aria-label="sin registro" className="text-label-3">
                    ·
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                className="text-[10.5px] font-medium text-label-3"
              >
                {point.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
