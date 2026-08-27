/**
 * Los cuatro compañeros.
 *
 * Comparten cuerpo y cambian oreja y color: así se construye una familia de
 * personajes — se reconocen entre sí y se pueden dibujar nuevos sin rehacer el
 * sistema. Son vector, no imagen, por tres razones: pesan unos 3 KB, se
 * recolorean solos, y pueden parpadear y saltar. Un PNG solo puede flotar.
 */

export type CompanionKey = "roco" | "chispa" | "brote" | "nube";

export type CompanionMood = "normal" | "contento" | "dormido" | "acompaña";

type Piel = {
  cuerpo: string;
  detalle: string;
  panza: string;
  fondo: string;
  tinta: string;
  nombre: string;
  frase: string;
};

export const COMPANIONS: Record<CompanionKey, Piel> = {
  roco: {
    cuerpo: "#DCE5FF",
    detalle: "#7F9BFF",
    panza: "#FFFFFF",
    fondo: "var(--c-azul)",
    tinta: "var(--c-azul-tinta)",
    nombre: "Roco",
    frase: "El que no se mueve. Para quien necesita firmeza.",
  },
  chispa: {
    cuerpo: "#FFD9C2",
    detalle: "#FF9A63",
    panza: "#FFFFFF",
    fondo: "var(--c-naranja)",
    tinta: "var(--c-naranja-tinta)",
    nombre: "Chispa",
    frase: "El que empuja. Para los días sin ganas.",
  },
  brote: {
    cuerpo: "#C3F5EA",
    detalle: "#5FD9C0",
    panza: "#FFFFFF",
    fondo: "var(--c-menta)",
    tinta: "var(--c-menta-tinta)",
    nombre: "Brote",
    frase: "El que crece contigo. Para quien va empezando.",
  },
  nube: {
    cuerpo: "#E0D8FF",
    detalle: "#A995FF",
    panza: "#FFFFFF",
    fondo: "var(--c-lila)",
    tinta: "var(--c-lila-tinta)",
    nombre: "Nube",
    frase: "El que calma. Para la ansiedad de las noches.",
  },
};

function Orejas({ who, piel }: { who: CompanionKey; piel: Piel }) {
  if (who === "roco") {
    return (
      <>
        <circle cx="30" cy="38" r="13" fill={piel.cuerpo} />
        <circle cx="90" cy="38" r="13" fill={piel.cuerpo} />
        <circle cx="30" cy="38" r="6" fill={piel.detalle} />
        <circle cx="90" cy="38" r="6" fill={piel.detalle} />
      </>
    );
  }

  if (who === "chispa") {
    return (
      <>
        <path d="M34 40 L26 12 L52 28 Z" fill={piel.cuerpo} />
        <path d="M86 40 L94 12 L68 28 Z" fill={piel.cuerpo} />
        <path d="M34 38 L30 20 L46 30 Z" fill={piel.detalle} />
        <path d="M86 38 L90 20 L74 30 Z" fill={piel.detalle} />
      </>
    );
  }

  if (who === "brote") {
    return (
      <>
        <path d="M60 26 L60 8" stroke="#2E9E86" strokeWidth="4" strokeLinecap="round" />
        <path d="M60 14 C50 14 44 8 44 2 C54 0 60 6 60 14 Z" fill="#8FE9D6" />
        <path d="M60 18 C70 18 78 12 78 5 C67 3 60 10 60 18 Z" fill={piel.detalle} />
      </>
    );
  }

  return (
    <>
      <circle cx="34" cy="34" r="11" fill={piel.cuerpo} />
      <circle cx="86" cy="34" r="11" fill={piel.cuerpo} />
    </>
  );
}

function Cara({ mood }: { mood: CompanionMood }) {
  if (mood === "dormido") {
    return (
      <>
        <path
          d="M40 70 q6 6 12 0"
          fill="none"
          stroke="#14161F"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M68 70 q6 6 12 0"
          fill="none"
          stroke="#14161F"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <ellipse cx="60" cy="86" rx="6" ry="8" fill="#14161F" />
      </>
    );
  }

  if (mood === "contento") {
    return (
      <>
        <path
          d="M40 68 q6 -8 12 0"
          fill="none"
          stroke="#14161F"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M68 68 q6 -8 12 0"
          fill="none"
          stroke="#14161F"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M52 82 q8 10 16 0"
          fill="none"
          stroke="#14161F"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </>
    );
  }

  return (
    <>
      <g className="parpadea">
        <ellipse cx="46" cy="70" rx="6" ry="8" fill="#14161F" />
        <ellipse cx="74" cy="70" rx="6" ry="8" fill="#14161F" />
      </g>
      <circle cx="48.4" cy="67" r="2" fill="#FFFFFF" />
      <circle cx="76.4" cy="67" r="2" fill="#FFFFFF" />
      <path
        d="M54 84 q6 6 12 0"
        fill="none"
        stroke="#14161F"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </>
  );
}

export function Companion({
  who,
  size = 120,
  mood = "normal",
  className = "",
  sombra = true,
}: {
  who: CompanionKey;
  size?: number;
  mood?: CompanionMood;
  className?: string;
  sombra?: boolean;
}) {
  const piel = COMPANIONS[who];

  return (
    <svg
      width={size}
      height={size * (130 / 120)}
      viewBox="0 0 120 130"
      className={className}
      role="img"
      aria-label={piel.nombre}
    >
      {sombra && <ellipse cx="60" cy="120" rx="30" ry="6" fill="rgba(0,0,0,0.14)" />}
      <Orejas who={who} piel={piel} />
      <path
        d="M60 24 C86 24 100 46 100 72 C100 100 82 116 60 116 C38 116 20 100 20 72 C20 46 34 24 60 24 Z"
        fill={piel.cuerpo}
      />
      <path
        d="M60 62 C74 62 84 72 84 86 C84 102 74 116 60 116 C46 116 36 102 36 86 C36 72 46 62 60 62 Z"
        fill={piel.panza}
        opacity="0.78"
      />
      <Cara mood={mood} />
      <ellipse cx="33" cy="82" rx="6.5" ry="4.5" fill={piel.detalle} opacity="0.7" />
      <ellipse cx="87" cy="82" rx="6.5" ry="4.5" fill={piel.detalle} opacity="0.7" />
    </svg>
  );
}
