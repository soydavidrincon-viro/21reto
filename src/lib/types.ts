export type HabitColor = "blue" | "orange" | "green" | "yellow" | "purple" | "pink";
export type LogStatus = "success" | "relapse" | "skipped";

export type DailyOverviewRow = {
  habit_id: string;
  name: string;
  kind: "quit" | "build";
  icon: string;
  color: HabitColor;
  target_days: number;
  start_date: string;
  relapse_policy: "reset" | "continue";
  /** Días de la semana en que toca, 0 = domingo. Por defecto, los siete. */
  active_dows: number[];
  /** Si hoy es uno de esos días. Lo resuelve el servidor con la fecha local. */
  toca_hoy: boolean;
  today_status: LogStatus | null;
  today_note: string | null;
  clean_days: number;
  current_streak: number;
  best_streak: number;
};

/**
 * Rellena lo que la base todavía no sabe dar.
 *
 * Entre que se despliega el código y se corre la migración pasa un rato, y en
 * ese rato `get_daily_overview` devuelve las columnas de antes. Sin esto, la
 * primera pantalla de la app se quedaba en blanco: `active_dows` llegaba
 * `undefined` y esparcirlo con `[...]` lanza una excepción que se lleva el
 * render entero.
 *
 * Los valores por defecto son los mismos que los de la columna en el esquema —
 * toca todos los días— así que mientras falte la migración la app se comporta
 * exactamente como se comportaba antes de que existieran los días, que es lo
 * correcto: no había días, tocaba siempre.
 */
export function conDiasPorDefecto(fila: DailyOverviewRow): DailyOverviewRow {
  if (Array.isArray(fila.active_dows) && typeof fila.toca_hoy === "boolean") {
    return fila;
  }
  return {
    ...fila,
    active_dows: Array.isArray(fila.active_dows)
      ? fila.active_dows
      : TODOS_LOS_DIAS,
    toca_hoy: typeof fila.toca_hoy === "boolean" ? fila.toca_hoy : true,
  };
}

export type Quote = { id: string; text: string; author: string | null };

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  theme: "system" | "light" | "dark";
  onboarded_at: string | null;
  companion: "roco" | "chispa" | "brote" | "nube";
  /** Hora local del recordatorio del día. null = avisos apagados. */
  reminder_hour: number | null;
  avisa_racha: boolean;
  avisa_hito: boolean;
  avisa_hora_dificil: boolean;
};

/** La hora que se propone al encender los avisos por primera vez. */
export const HORA_AVISO_POR_DEFECTO = 21;

/**
 * Cada color de hábito con su tinta. El blanco sobre naranja, menta y ámbar no
 * se lee al sol, así que el color no viaja solo: trae el texto que le toca.
 */
export const HABIT_SKIN: Record<HabitColor, { fondo: string; tinta: string }> = {
  blue: { fondo: "var(--c-azul)", tinta: "var(--c-azul-tinta)" },
  orange: { fondo: "var(--c-naranja)", tinta: "var(--c-naranja-tinta)" },
  green: { fondo: "var(--c-menta)", tinta: "var(--c-menta-tinta)" },
  yellow: { fondo: "var(--c-ambar)", tinta: "var(--c-ambar-tinta)" },
  purple: { fondo: "var(--c-lila)", tinta: "var(--c-lila-tinta)" },
  pink: { fondo: "var(--c-naranja)", tinta: "var(--c-naranja-tinta)" },
};

/** Los anillos SVG no pasan por Tailwind, así que necesitan el hex resuelto. */
export const HABIT_HEX: Record<HabitColor, string> = {
  blue: "#2D5BFF",
  orange: "#FF6B2C",
  green: "#00C9A7",
  yellow: "#FFC53D",
  purple: "#7B61FF",
  pink: "#FF6B2C",
};

/**
 * Los estados de ánimo de la bitácora. El emoji es el dato que se guarda; en
 * iPhone y Mac se pinta con los glifos de Apple sin que la app envíe nada.
 *
 * `score` del 1 al 5 existe solo para poder dibujar la línea de ánimo. Es una
 * simplificación discutible — estar orgulloso y estar en calma no son el mismo
 * punto de una recta — pero sin un orden no hay gráfica posible.
 */
export const MOODS = [
  { key: "genial", emoji: "😄", label: "Genial", score: 5 },
  { key: "orgulloso", emoji: "🥳", label: "Orgulloso", score: 5 },
  { key: "bien", emoji: "🙂", label: "Bien", score: 4 },
  { key: "en_calma", emoji: "😌", label: "En calma", score: 4 },
  { key: "neutral", emoji: "😐", label: "Neutral", score: 3 },
  { key: "cansado", emoji: "🥱", label: "Cansado", score: 3 },
  { key: "bajo", emoji: "😔", label: "Bajo", score: 2 },
  { key: "tenso", emoji: "😣", label: "Tenso", score: 2 },
  { key: "molesto", emoji: "😤", label: "Molesto", score: 2 },
  { key: "ansioso", emoji: "😰", label: "Ansioso", score: 2 },
  { key: "enfermo", emoji: "🤒", label: "Enfermo", score: 2 },
  { key: "vacio", emoji: "🫥", label: "Vacío", score: 1 },
] as const;

export const MOOD_BY_KEY = new Map(MOODS.map((mood) => [mood.key as string, mood]));

/**
 * Los disparadores de un impulso. Lista cerrada a propósito: con texto libre
 * cada quien escribe "estres", "estrés" y "mucho estres", y agrupar se vuelve
 * imposible — que es justo para lo que existe el registro. El matiz va en la
 * nota.
 */
export const CRAVING_TRIGGERS = [
  { key: "estres", label: "Estrés" },
  { key: "aburrimiento", label: "Aburrimiento" },
  { key: "gente", label: "La gente" },
  { key: "lugar", label: "El lugar" },
  { key: "celebracion", label: "Celebración" },
  { key: "tristeza", label: "Tristeza" },
  { key: "otro", label: "Otro" },
] as const;

export const TRIGGER_BY_KEY = new Map(
  CRAVING_TRIGGERS.map((t) => [t.key as string, t]),
);

/** Los seis bloques de cuatro horas de la rejilla de impulsos. */
export const CRAVING_BLOCKS = [
  "12–4 a.m.",
  "4–8 a.m.",
  "8 a.m.–12",
  "12–4 p.m.",
  "4–8 p.m.",
  "8 p.m.–12",
];

export const DOW_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Una letra por día, para el selector de días. El índice es el `dow`. */
export const DOW_INICIALES = ["D", "L", "M", "M", "J", "V", "S"];

export const TODOS_LOS_DIAS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Cómo se leen los días de un hábito: "Todos los días", "Lun, Mié y Vie".
 *
 * Los dos casos con nombre propio existen porque son los dos que más se eligen
 * y porque "Lun, Mar, Mié, Jue y Vie" ocupa media tarjeta para decir algo que
 * cabe en dos palabras.
 */
export function comoSeLeenLosDias(dows: number[] | null | undefined): string {
  // Tolera que no venga nada. Esta función se pinta dentro de una tarjeta, y
  // una excepción aquí no rompe una etiqueta: se lleva por delante la pantalla
  // entera. Sin días, lo honesto es decir que toca siempre, que es el valor
  // por defecto de la columna.
  if (!Array.isArray(dows) || dows.length === 0) return "Todos los días";

  const dias = [...dows].sort((a, b) => a - b);
  if (dias.length === 7) return "Todos los días";
  if (dias.length === 5 && dias.every((d) => d >= 1 && d <= 5)) {
    return "Entre semana";
  }
  if (dias.length === 2 && dias[0] === 0 && dias[1] === 6) {
    return "Fines de semana";
  }

  const nombres = dias.map((d) => DOW_LABELS[d]);
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

export type CravingGridCell = {
  dow: number;
  block: number;
  total: number;
  resisted: number;
};

export type CravingSummary = {
  total: number;
  resisted: number;
  caved: number;
  top_trigger: string | null;
  top_trigger_total: number | null;
  top_dow: number | null;
  top_block: number | null;
  top_block_total: number | null;
};

/**
 * Cuántos impulsos hacen falta antes de que la app afirme algo.
 *
 * Con cuatro registros cualquier "patrón" es ruido, y decirle a alguien "tu
 * hora difícil son los martes" con esa muestra sería inventar. Hasta llegar
 * aquí, la app enseña cuántos faltan.
 */
export const MIN_PARA_HABLAR = 8;

/**
 * Cómo se lee un hábito dentro de una frase: "sin alcohol", "de ejercicio".
 *
 * Dos trampas que aparecieron al escribir la tarjeta compartible. Una: los
 * hábitos que se construyen no van con "sin" — "21 días sin ejercicio" dice lo
 * contrario de lo que pasó. Otra: mucha gente bautiza el suyo "Sin alcohol",
 * y concatenar a ciegas daba "días sin sin alcohol".
 */
export function comoSeLee(kind: "quit" | "build", name: string): string {
  const limpio = name.trim().replace(/^sin\s+/i, "").toLowerCase();
  return kind === "build" ? `de ${limpio}` : `sin ${limpio}`;
}
