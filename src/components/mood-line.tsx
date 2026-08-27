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
    const score = point.mood ? (MOOD_BY_KEY.get(point.mood)?.score ?? null) : null;
    const x = 12 + (i * (width - 24)) / Math.max(points.length - 1, 1);
    const y = score === null ? null : bottom - ((score - 1) / 4) * (bottom - top);
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

        {filled.map((point) => (
          <circle
            key={point.date}
            cx={point.x}
            cy={point.y!}
            r={point.date === last?.date ? 5 : 4}
            className="fill-azul stroke-card"
            strokeWidth="2"
          >
            <title>
              {point.label}: {MOOD_BY_KEY.get(point.mood!)?.label}
            </title>
          </circle>
        ))}
      </svg>

      <ol className="flex justify-between">
        {points.map((point) => (
          <li key={point.date} className="text-[17px]" title={point.label}>
            {point.mood ? (
              <span aria-label={MOOD_BY_KEY.get(point.mood)?.label}>
                {MOOD_BY_KEY.get(point.mood)?.emoji}
              </span>
            ) : (
              <span aria-label="sin registro" className="text-label-3">
                ·
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
