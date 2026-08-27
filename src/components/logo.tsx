/**
 * La marca: una gota con el centro hueco.
 *
 * Lo que se quita, no lo que se agrega — y ese hueco es el mismo anillo de
 * progreso que la app usa en todas partes, así que el logo y el producto
 * dicen la misma cosa.
 */
export function Isotipo({
  size = 32,
  fondo = "var(--c-azul)",
  gota = "var(--c-azul-tinta)",
}: {
  size?: number;
  fondo?: string;
  gota?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
      <rect width="60" height="60" rx="17" fill={fondo} />
      <path
        d="M30 12 C 40 22, 45 28, 45 35 a 15 15 0 0 1 -30 0 c 0 -7, 5 -13, 15 -23 Z"
        fill={gota}
      />
      <circle cx="30" cy="36" r="6.5" fill={fondo} />
    </svg>
  );
}

export function Logo({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Isotipo size={size} />
      <span
        className="font-display font-semibold tracking-[-0.01em] text-label"
        style={{ fontSize: size * 0.72 }}
      >
        Antídoto
      </span>
    </span>
  );
}
