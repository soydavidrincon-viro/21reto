/**
 * Los cuatro compañeros.
 *
 * Cada uno es un animal distinto y no el mismo cuerpo con otra oreja: un oso,
 * un zorro, una tortuga y un conejo. Comparten proporciones y construcción, que
 * es lo que los hace familia, pero se distinguen de lejos y a 40px.
 *
 * Son vector, no imagen, por tres razones: pesan unos 3 KB, se recolorean solos
 * con el tema, y pueden parpadear, dormirse y saltar. Un PNG solo puede flotar.
 *
 * Y no son adorno: la cara y la etapa salen del estado real de la persona. Un
 * muñeco que se ve igual el día que llevas veinte seguidos y el día que
 * acabas de romper la racha no está diciendo nada.
 */

export type CompanionKey = "roco" | "chispa" | "brote" | "nube";

/**
 * `apagado` es el estado de racha rota. Se apaga, no regaña ni llora: la app
 * entera está construida sobre que la recaída no se castiga, y un muñeco
 * triste mirándote sería el castigo que el resto del producto se niega a dar.
 */
export type CompanionMood =
  | "normal"
  | "contento"
  | "dormido"
  | "apagado"
  | "celebra";

/**
 * Crece con la racha. Tres etapas y no diez porque tienen que distinguirse de
 * un vistazo: pañuelo a la semana, corona de hojas a las tres.
 */
export type CompanionEtapa = 1 | 2 | 3;

export function etapaDeRacha(racha: number): CompanionEtapa {
  if (racha >= 21) return 3;
  if (racha >= 7) return 2;
  return 1;
}

type Piel = {
  cuerpo: string;
  detalle: string;
  panza: string;
  fondo: string;
  tinta: string;
  nombre: string;
  animal: string;
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
    animal: "oso",
    frase: "El oso que no se mueve. Para quien necesita firmeza.",
  },
  chispa: {
    cuerpo: "#FFD9C2",
    detalle: "#FF9A63",
    panza: "#FFFFFF",
    fondo: "var(--c-naranja)",
    tinta: "var(--c-naranja-tinta)",
    nombre: "Chispa",
    animal: "zorro",
    frase: "El zorro que empuja. Para los días sin ganas.",
  },
  brote: {
    cuerpo: "#C3F5EA",
    detalle: "#5FD9C0",
    panza: "#FFFFFF",
    fondo: "var(--c-menta)",
    tinta: "var(--c-menta-tinta)",
    nombre: "Brote",
    animal: "tortuga",
    frase: "La tortuga que llega igual. Para quien va empezando.",
  },
  nube: {
    cuerpo: "#E0D8FF",
    detalle: "#A995FF",
    panza: "#FFFFFF",
    fondo: "var(--c-lila)",
    tinta: "var(--c-lila-tinta)",
    nombre: "Nube",
    animal: "conejo",
    frase: "El conejo que calma. Para la ansiedad de las noches.",
  },
};

const TRAZO = "#14161F";

/** Orejas y cola: lo que convierte el mismo cuerpo en cuatro animales. */
function Rasgos({ who, piel }: { who: CompanionKey; piel: Piel }) {
  if (who === "roco") {
    // Oso: orejas redondas y altas, bien separadas.
    return (
      <>
        <circle cx="30" cy="36" r="14" fill={piel.cuerpo} />
        <circle cx="90" cy="36" r="14" fill={piel.cuerpo} />
        <circle cx="30" cy="36" r="7" fill={piel.detalle} />
        <circle cx="90" cy="36" r="7" fill={piel.detalle} />
      </>
    );
  }

  if (who === "chispa") {
    // Zorro: orejas en punta y cola asomando por detrás.
    return (
      <>
        <path
          d="M104 104 C118 96 122 78 112 68 C108 84 100 94 92 100 Z"
          fill={piel.detalle}
        />
        <path
          d="M108 92 C116 88 118 78 114 72 C111 81 109 88 106 91 Z"
          fill="#FFFFFF"
          opacity="0.85"
        />
        <path d="M34 42 L25 10 L54 30 Z" fill={piel.cuerpo} />
        <path d="M86 42 L95 10 L66 30 Z" fill={piel.cuerpo} />
        <path d="M35 40 L30 20 L47 32 Z" fill={piel.detalle} />
        <path d="M85 40 L90 20 L73 32 Z" fill={piel.detalle} />
      </>
    );
  }

  if (who === "brote") {
    // Tortuga: el brote sigue ahí, ahora saliendo del caparazón. Se queda
    // porque es el personaje que la gente vio primero y por el que se llama
    // así; lo nuevo es el animal debajo.
    return (
      <>
        <path
          d="M60 26 L60 6"
          stroke="#2E9E86"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M60 14 C50 14 44 8 44 2 C54 0 60 6 60 14 Z" fill="#8FE9D6" />
        <path d="M60 18 C70 18 78 12 78 5 C67 3 60 10 60 18 Z" fill={piel.detalle} />
        {/* Patitas */}
        <ellipse cx="24" cy="104" rx="10" ry="7" fill={piel.detalle} />
        <ellipse cx="96" cy="104" rx="10" ry="7" fill={piel.detalle} />
      </>
    );
  }

  // Conejo: orejas largas, una un poco caída.
  return (
    <>
      <path
        d="M42 40 C36 40 32 26 34 12 C36 2 44 2 46 12 C48 26 48 40 42 40 Z"
        fill={piel.cuerpo}
      />
      <path
        d="M78 40 C84 40 90 28 90 16 C90 6 82 4 79 14 C76 26 72 40 78 40 Z"
        fill={piel.cuerpo}
      />
      <path
        d="M42 34 C39 34 37 24 38 15 C39 9 43 9 44 15 C45 24 45 34 42 34 Z"
        fill={piel.detalle}
      />
      <path
        d="M78 34 C81 34 84 25 84 17 C84 11 80 10 79 16 C77 25 75 34 78 34 Z"
        fill={piel.detalle}
      />
    </>
  );
}

/** El hocico. Lo que más hace que se lean como animal y no como bolita. */
function Hocico({ who, piel }: { who: CompanionKey; piel: Piel }) {
  if (who === "brote") return null;

  const puntiagudo = who === "chispa";

  return (
    <>
      <ellipse
        cx="60"
        cy="84"
        rx={puntiagudo ? 15 : 18}
        ry={puntiagudo ? 13 : 12}
        fill={piel.panza}
        opacity="0.95"
      />
      <ellipse cx="60" cy="78" rx="5" ry="3.6" fill={TRAZO} />
      <path
        d="M60 81 L60 86"
        stroke={TRAZO}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </>
  );
}

/** El caparazón de la tortuga, que le hace de panza. */
function Caparazon({ piel }: { piel: Piel }) {
  return (
    <>
      <path
        d="M60 60 C76 60 88 72 88 88 C88 104 76 116 60 116 C44 116 32 104 32 88 C32 72 44 60 60 60 Z"
        fill={piel.detalle}
        opacity="0.55"
      />
      <path
        d="M60 66 C70 66 78 74 78 84"
        fill="none"
        stroke={piel.detalle}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M60 66 C50 66 42 74 42 84"
        fill="none"
        stroke={piel.detalle}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  );
}

function Cara({ mood }: { mood: CompanionMood }) {
  if (mood === "dormido") {
    return (
      <>
        <path
          d="M38 68 q7 7 14 0"
          fill="none"
          stroke={TRAZO}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M68 68 q7 7 14 0"
          fill="none"
          stroke={TRAZO}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </>
    );
  }

  // Racha rota: ojos a media asta y boca recta.
  //
  // Sin cejas. La primera versión las llevaba y salía con cara de enojado —
  // dos trazos curvados hacia el centro son un ceño, se quiera o no. Y un
  // muñeco molesto contigo sería exactamente el castigo que el resto de la app
  // se niega a dar. Media luna de párpado y ya: se lee cansado, no juzgando.
  if (mood === "apagado") {
    return (
      <>
        <path d="M41 68 a5 5 0 0 0 10 0 Z" fill={TRAZO} />
        <path d="M69 68 a5 5 0 0 0 10 0 Z" fill={TRAZO} />
      </>
    );
  }

  if (mood === "celebra") {
    return (
      <>
        <path
          d="M38 66 q7 -10 14 0"
          fill="none"
          stroke={TRAZO}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        <path
          d="M68 66 q7 -10 14 0"
          fill="none"
          stroke={TRAZO}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
      </>
    );
  }

  if (mood === "contento") {
    return (
      <>
        <path
          d="M40 66 q6 -8 12 0"
          fill="none"
          stroke={TRAZO}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M68 66 q6 -8 12 0"
          fill="none"
          stroke={TRAZO}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </>
    );
  }

  return (
    <>
      <g className="parpadea">
        <ellipse cx="46" cy="68" rx="6" ry="8" fill={TRAZO} />
        <ellipse cx="74" cy="68" rx="6" ry="8" fill={TRAZO} />
      </g>
      <circle cx="48.4" cy="65" r="2" fill="#FFFFFF" />
      <circle cx="76.4" cy="65" r="2" fill="#FFFFFF" />
    </>
  );
}

/** La boca vive aparte porque en los que tienen hocico va sobre él. */
function Boca({ mood }: { mood: CompanionMood }) {
  if (mood === "dormido") {
    return <ellipse cx="60" cy="94" rx="5.5" ry="7" fill={TRAZO} />;
  }
  if (mood === "apagado") {
    return (
      <path
        d="M53 92 L67 92"
        stroke={TRAZO}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    );
  }
  if (mood === "celebra") {
    return (
      <path
        d="M50 88 q10 14 20 0 Z"
        fill={TRAZO}
        stroke={TRAZO}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    );
  }
  return (
    <path
      d="M53 89 q7 7 14 0"
      fill="none"
      stroke={TRAZO}
      strokeWidth="2.6"
      strokeLinecap="round"
    />
  );
}

/** Lo que se gana con la racha: pañuelo a los siete días, corona a los 21. */
function Etapa({ etapa, piel }: { etapa: CompanionEtapa; piel: Piel }) {
  if (etapa === 1) return null;

  return (
    <>
      {/* Pañuelo, no zócalo: va alto y estrecho para que se lea como algo
          puesto encima y no como que el muñeco está metido en agua de color. */}
      <path
        d="M35 99 C45 106 75 106 85 99 C84 106 79 110 60 110 C41 110 36 106 35 99 Z"
        fill={piel.fondo}
      />
      {etapa === 3 && (
        <>
          <path
            d="M40 30 C34 22 36 14 42 12 C46 18 46 26 42 32 Z"
            fill="#3FBF9C"
          />
          <path
            d="M80 30 C86 22 84 14 78 12 C74 18 74 26 78 32 Z"
            fill="#3FBF9C"
          />
          <circle cx="60" cy="16" r="5" fill="var(--c-ambar)" />
        </>
      )}
    </>
  );
}

export function Companion({
  who,
  size = 120,
  mood = "normal",
  etapa = 1,
  className = "",
  sombra = true,
}: {
  who: CompanionKey;
  size?: number;
  mood?: CompanionMood;
  etapa?: CompanionEtapa;
  className?: string;
  sombra?: boolean;
}) {
  const piel = COMPANIONS[who];
  const tortuga = who === "brote";

  return (
    <svg
      width={size}
      height={size * (130 / 120)}
      viewBox="0 0 120 130"
      className={className}
      role="img"
      aria-label={`${piel.nombre}, tu ${piel.animal}`}
    >
      {sombra && (
        <ellipse cx="60" cy="120" rx="30" ry="6" fill="rgba(0,0,0,0.14)" />
      )}

      <Rasgos who={who} piel={piel} />

      <path
        d="M60 24 C86 24 100 46 100 72 C100 100 82 116 60 116 C38 116 20 100 20 72 C20 46 34 24 60 24 Z"
        fill={piel.cuerpo}
      />

      {tortuga ? (
        <Caparazon piel={piel} />
      ) : (
        <path
          d="M60 62 C74 62 84 72 84 86 C84 102 74 116 60 116 C46 116 36 102 36 86 C36 72 46 62 60 62 Z"
          fill={piel.panza}
          opacity="0.78"
        />
      )}

      <Cara mood={mood} />
      <Hocico who={who} piel={piel} />
      <Boca mood={mood} />

      {/* Cachetes. Se apagan cuando el muñeco está apagado. */}
      <ellipse
        cx="31"
        cy="80"
        rx="6.5"
        ry="4.5"
        fill={piel.detalle}
        opacity={mood === "apagado" ? 0.25 : 0.7}
      />
      <ellipse
        cx="89"
        cy="80"
        rx="6.5"
        ry="4.5"
        fill={piel.detalle}
        opacity={mood === "apagado" ? 0.25 : 0.7}
      />

      <Etapa etapa={etapa} piel={piel} />

      {/* Zzz solo cuando duerme, y con el mismo trazo que el resto. */}
      {mood === "dormido" && (
        <g fill={TRAZO} opacity="0.55">
          <text x="96" y="40" fontSize="14" fontWeight="700">
            z
          </text>
          <text x="106" y="26" fontSize="10" fontWeight="700">
            z
          </text>
        </g>
      )}
    </svg>
  );
}
