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
  today_status: LogStatus | null;
  today_note: string | null;
  clean_days: number;
  current_streak: number;
  best_streak: number;
};

export type Quote = { id: string; text: string; author: string | null };

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  theme: "system" | "light" | "dark";
  onboarded_at: string | null;
  companion: "roco" | "chispa" | "brote" | "nube";
};

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
