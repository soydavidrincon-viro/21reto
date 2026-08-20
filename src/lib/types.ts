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
 */
export const MOODS = [
  { key: "genial", emoji: "😄", label: "Genial" },
  { key: "bien", emoji: "🙂", label: "Bien" },
  { key: "neutral", emoji: "😐", label: "Neutral" },
  { key: "bajo", emoji: "😔", label: "Bajo" },
  { key: "tenso", emoji: "😣", label: "Tenso" },
  { key: "molesto", emoji: "😤", label: "Molesto" },
  { key: "ansioso", emoji: "😰", label: "Ansioso" },
  { key: "cansado", emoji: "🥱", label: "Cansado" },
  { key: "enfermo", emoji: "🤒", label: "Enfermo" },
  { key: "orgulloso", emoji: "🥳", label: "Orgulloso" },
  { key: "en_calma", emoji: "😌", label: "En calma" },
  { key: "vacio", emoji: "🫥", label: "Vacío" },
] as const;
