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
};

/** Hex de cada color de hábito, para los anillos SVG que no pasan por Tailwind. */
export const HABIT_HEX: Record<HabitColor, string> = {
  blue: "#007AFF",
  orange: "#FF9500",
  green: "#34C759",
  yellow: "#FFCC00",
  purple: "#AF52DE",
  pink: "#FF2D55",
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
