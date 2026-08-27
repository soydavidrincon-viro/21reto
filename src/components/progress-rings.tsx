import { HABIT_HEX, type HabitColor } from "@/lib/types";

type Ring = { color: HabitColor; value: number; goal: number; label: string };

/**
 * Anillos concéntricos, como los de Fitness: uno por hábito activo, el más
 * avanzado por fuera. El trazo redondeado hace que un progreso de 1 de 21 se
 * siga viendo como algo empezado y no como un anillo vacío.
 *
 * El llenado es CSS, no JavaScript. `stroke-dasharray` ya queda en el valor
 * final, y la animación solo mueve `stroke-dashoffset` de ahí a cero: si el
 * script no corre, el navegador usa el offset por defecto —cero— y los anillos
 * aparecen llenos en vez de vacíos. La versión anterior los dibujaba en cero y
 * esperaba a la hidratación para llenarlos.
 */
export function ProgressRings({
  rings,
  size = 132,
  className,
}: {
  rings: Ring[];
  size?: number;
  className?: string;
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
        .map((ring) => `${ring.label}: ${ring.value} de ${ring.goal} días`)
        .join(". ")}
      className={`shrink-0 ${className ?? ""}`}
    >
      <g transform="rotate(-90 70 70)">
        {visible.map((ring, i) => {
          const radius = 52 - i * (width + gap);
          const circumference = 2 * Math.PI * radius;
          const ratio = Math.max(0, Math.min(1, ring.value / Math.max(ring.goal, 1)));
          const hex = HABIT_HEX[ring.color];
          const filled = circumference * ratio;

          return (
            <g key={ring.label}>
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
                className="llenar"
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={hex}
                strokeWidth={width}
                strokeLinecap="round"
                strokeDasharray={`${filled} ${circumference}`}
                style={
                  {
                    "--dash": filled,
                    animationDelay: `${i * 0.12}s`,
                  } as React.CSSProperties
                }
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
