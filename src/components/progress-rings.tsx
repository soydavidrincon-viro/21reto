import { HABIT_HEX, type HabitColor } from "@/lib/types";

type Ring = { color: HabitColor; value: number; goal: number };

/**
 * Anillos concéntricos, como los de Fitness: uno por hábito activo, el más
 * avanzado por fuera. El trazo redondeado hace que un progreso de 1 de 21 se
 * siga viendo como algo empezado y no como un anillo vacío.
 */
export function ProgressRings({
  rings,
  size = 132,
}: {
  rings: Ring[];
  size?: number;
}) {
  const visible = rings.slice(0, 3);
  const width = 14;
  const gap = 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      role="img"
      aria-label={visible
        .map((r) => `${Math.round((r.value / r.goal) * 100)}%`)
        .join(", ")}
      className="shrink-0"
    >
      <g transform="rotate(-90 70 70)">
        {visible.map((ring, i) => {
          const radius = 52 - i * (width + gap);
          const circumference = 2 * Math.PI * radius;
          const ratio = Math.max(0, Math.min(1, ring.value / Math.max(ring.goal, 1)));
          const hex = HABIT_HEX[ring.color];

          return (
            <g key={i}>
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={hex}
                strokeOpacity={0.18}
                strokeWidth={width}
              />
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={hex}
                strokeWidth={width}
                strokeLinecap="round"
                strokeDasharray={`${circumference * ratio} ${circumference}`}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
