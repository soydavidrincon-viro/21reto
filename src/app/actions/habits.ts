"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { HabitColor, Profile } from "@/lib/types";

export type NewHabit = {
  name: string;
  icon: string;
  color: HabitColor;
  targetDays: number;
  relapsePolicy: "reset" | "continue";
  /** Solo en el alta inicial: cierra el onboarding al crear el primer hábito. */
  finishOnboarding?: boolean;
};

export async function createHabit(input: NewHabit) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  const name = input.name.trim();
  if (!name) return { error: "Ponle un nombre al hábito." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<Profile, "timezone">>();

  // El reto arranca hoy según el reloj del usuario, no el del servidor.
  const startDate = todayIn(profile?.timezone ?? "UTC");

  const { error } = await supabase.from("habits").insert({
    user_id: user.id,
    name,
    icon: input.icon,
    color: input.color,
    target_days: input.targetDays,
    relapse_policy: input.relapsePolicy,
    start_date: startDate,
  });

  if (error) return { error: error.message };

  if (input.finishOnboarding) {
    await supabase
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  revalidatePath("/hoy");
  redirect("/hoy");
}

export async function archiveHabit(habitId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("habits")
    .update({ status: "archived" })
    .eq("id", habitId);

  if (error) return { error: error.message };

  revalidatePath("/hoy");
  redirect("/hoy");
}
