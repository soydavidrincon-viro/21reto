"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LogStatus } from "@/lib/types";

/**
 * Marca un día de un hábito.
 *
 * `dateISO` llega del servidor ya resuelto con la zona horaria del perfil; la
 * acción nunca la deduce por su cuenta. El upsert sobre (habit_id, log_date)
 * hace que volver a marcar el mismo día corrija el registro en vez de duplicarlo.
 */
export async function markDay(
  habitId: string,
  dateISO: string,
  status: LogStatus,
  note?: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Necesitas iniciar sesión." };

  const { error } = await supabase.from("habit_logs").upsert(
    {
      habit_id: habitId,
      user_id: user.id,
      log_date: dateISO,
      status,
      note: note ?? null,
    },
    { onConflict: "habit_id,log_date" },
  );

  if (error) return { error: error.message };

  revalidatePath("/hoy");
  revalidatePath(`/habito/${habitId}`);
  return { error: null };
}

/** Quita el registro del día, para cuando alguien marcó por error. */
export async function clearDay(habitId: string, dateISO: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("habit_logs")
    .delete()
    .eq("habit_id", habitId)
    .eq("log_date", dateISO);

  if (error) return { error: error.message };

  revalidatePath("/hoy");
  revalidatePath(`/habito/${habitId}`);
  return { error: null };
}

/** Guarda la reacción del día. Una entrada por usuario por fecha. */
export async function saveMood(
  dateISO: string,
  mood: string,
  intensity = 3,
  note?: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Necesitas iniciar sesión." };

  const { error } = await supabase.from("journal_entries").upsert(
    {
      user_id: user.id,
      entry_date: dateISO,
      mood,
      intensity,
      note: note ?? null,
    },
    { onConflict: "user_id,entry_date" },
  );

  if (error) return { error: error.message };

  revalidatePath("/hoy");
  revalidatePath("/bitacora");
  return { error: null };
}
