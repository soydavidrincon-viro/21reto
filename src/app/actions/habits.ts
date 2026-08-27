"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { HabitColor, Profile } from "@/lib/types";

export type NewHabit = {
  name: string;
  /**
   * Dejar algo o empezar algo. Se cuentan igual —un día hecho es un día
   * hecho— y solo cambian las palabras que ve la persona.
   */
  kind: "quit" | "build";
  icon: string;
  color: HabitColor;
  targetDays: number;
  relapsePolicy: "reset" | "continue";
  /** Solo en el alta inicial: cierra el onboarding al crear el primer hábito. */
  finishOnboarding?: boolean;
  /**
   * Zona horaria detectada en el navegador. Entrar con Google no deja
   * metadatos donde venga —a diferencia del enlace por correo, que la manda al
   * pedirlo—, así que el onboarding es el punto por donde pasa todo el mundo y
   * sirve para resolverla antes del primer check.
   */
  timezone?: string;
  /** Compañero elegido en el onboarding. Va en el perfil, no en el hábito. */
  companion?: string;
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

  // Solo se siembra si el perfil sigue en el valor por defecto: si la persona
  // ya la corrigió a mano en Perfil, el navegador no debe pisarla.
  let zone = profile?.timezone ?? "UTC";
  if (input.timezone && zone === "UTC") {
    await supabase.from("profiles").update({ timezone: input.timezone }).eq("id", user.id);
    zone = input.timezone;
  }

  // El reto arranca hoy según el reloj del usuario, no el del servidor.
  const startDate = todayIn(zone);

  const { error } = await supabase.from("habits").insert({
    user_id: user.id,
    name,
    kind: input.kind,
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
      .update({
        onboarded_at: new Date().toISOString(),
        ...(input.companion ? { companion: input.companion } : {}),
      })
      .eq("id", user.id);
  }

  revalidatePath("/hoy");
  redirect("/hoy");
}

/**
 * Subir la meta de un reto que ya se cumplió.
 *
 * Existe porque el día 22 no existía. Al llegar a la meta no pasaba nada: la
 * barra se quedaba llena y la persona que lo logró —justo la que hay que
 * conservar— se quedaba sin nada que hacer. Y lo de los 21 días es un mito de
 * un libro de cirugía plástica de los sesenta, no evidencia: el día 21 es un
 * puesto de control, no la meta.
 *
 * No se toca `start_date` ni se borra un solo registro: los días acumulados
 * siguen contando contra la meta nueva.
 */
export async function extendHabit(habitId: string, nuevaMeta: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  if (!Number.isInteger(nuevaMeta) || nuevaMeta < 1 || nuevaMeta > 3650) {
    return { error: "Esa meta no es válida." };
  }

  const { data: actual } = await supabase
    .from("habits")
    .select("target_days")
    .eq("id", habitId)
    .maybeSingle<{ target_days: number }>();

  if (!actual) return { error: "No encontramos ese hábito." };
  if (nuevaMeta <= actual.target_days) {
    return { error: "La meta nueva tiene que ser mayor que la de ahora." };
  }

  const { error } = await supabase
    .from("habits")
    .update({ target_days: nuevaMeta })
    .eq("id", habitId);

  if (error) return { error: error.message };

  revalidatePath("/hoy");
  revalidatePath(`/habito/${habitId}`);
  return { error: null };
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
