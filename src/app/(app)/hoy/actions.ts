"use server";

import { revalidatePath } from "next/cache";
import { esFechaISO, shiftISO, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import {
  DIAS_PARA_CONTESTAR,
  LOG_STATUSES,
  MOOD_BY_KEY,
  type LogStatus,
  type Profile,
} from "@/lib/types";

/** Hasta 4000 caracteres, lo mismo que el `maxLength` de los editores. */
const MAX_NOTA = 4000;

/**
 * ¿Es una fecha que la app puede aceptar para esta cuenta?
 *
 * Con forma de `yyyy-MM-dd`, no después de hoy — de SU hoy, el de la zona del
 * perfil— y no más de siete días atrás. Un registro con fecha futura inflaba
 * la racha; uno de hace un mes reescribe el pasado. Los huecos se contestan
 * durante una semana; después se quedan como estaban.
 */
async function fechaAceptable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dateISO: unknown,
): Promise<{ fecha: string | null; error: string }> {
  if (!esFechaISO(dateISO)) return { fecha: null, error: "Esa fecha no existe." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single<Pick<Profile, "timezone">>();

  const hoy = todayIn(profile?.timezone ?? "UTC");
  if (dateISO > hoy) return { fecha: null, error: "Ese día todavía no ha llegado." };
  if (dateISO < shiftISO(hoy, -DIAS_PARA_CONTESTAR)) {
    return { fecha: null, error: "Ese día ya no se puede cambiar." };
  }
  return { fecha: dateISO, error: "" };
}

/** Las pantallas que enseñan registros de hábitos, para revalidarlas juntas. */
function revalidarRegistros(habitId: string) {
  revalidatePath("/hoy");
  revalidatePath("/progreso");
  revalidatePath("/bitacora");
  revalidatePath(`/habito/${habitId}`);
}

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

  if (!user) return { error: "Necesitas iniciar sesión.", streak: null };

  if (!LOG_STATUSES.includes(status)) {
    return { error: "Ese estado no existe.", streak: null };
  }
  if (note !== undefined && (typeof note !== "string" || note.length > MAX_NOTA)) {
    return { error: "La nota es demasiado larga.", streak: null };
  }

  const { fecha, error: fechaError } = await fechaAceptable(supabase, user.id, dateISO);
  if (!fecha) return { error: fechaError, streak: null };

  const { error } = await supabase.from("habit_logs").upsert(
    {
      habit_id: habitId,
      user_id: user.id,
      log_date: fecha,
      status,
      note: note ?? null,
    },
    { onConflict: "habit_id,log_date" },
  );

  if (error) return { error: error.message, streak: null };

  // La racha se relee del servidor en vez de sumarle uno a la que tenía el
  // cliente: con la política 'reset' una recaída la manda a cero, y adivinarlo
  // desde el navegador haría que la celebración de un hito saliera equivocada.
  const { data } = await supabase.rpc("get_habit_stats", {
    p_habit_id: habitId,
    p_today: fecha,
  });

  revalidarRegistros(habitId);
  return { error: null, streak: data?.[0]?.current_streak ?? null };
}

/** Quita el registro del día, para cuando alguien marcó por error. */
export async function clearDay(habitId: string, dateISO: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  const { fecha, error: fechaError } = await fechaAceptable(supabase, user.id, dateISO);
  if (!fecha) return { error: fechaError };

  // Doble cerrojo: la política RLS ya limita a lo propio, y el filtro por
  // user_id hace que un fallo de política no baste por sí solo.
  const { error } = await supabase
    .from("habit_logs")
    .delete()
    .eq("habit_id", habitId)
    .eq("user_id", user.id)
    .eq("log_date", fecha);

  if (error) return { error: error.message };

  revalidarRegistros(habitId);
  return { error: null };
}

/**
 * Guarda la entrada de bitácora del día. Una por usuario y fecha.
 *
 * Los campos que no vienen se conservan: el selector de ánimo y el editor de
 * nota escriben en la misma fila, y un upsert plano haría que cambiar el emoji
 * borrara lo que la persona acababa de escribir.
 */
export async function saveJournal(
  dateISO: string,
  patch: { mood?: string; intensity?: number; note?: string | null },
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Necesitas iniciar sesión." };

  // La bitácora sí se puede escribir hacia atrás sin límite: es un diario,
  // no un contador. Solo se exige que el día exista y no sea futuro.
  if (!esFechaISO(dateISO)) return { error: "Esa fecha no existe." };
  const { data: perfil } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<Profile, "timezone">>();
  if (dateISO > todayIn(perfil?.timezone ?? "UTC")) {
    return { error: "Ese día todavía no ha llegado." };
  }
  const fecha = dateISO;

  if (patch.mood !== undefined && !MOOD_BY_KEY.has(patch.mood)) {
    return { error: "Esa cara no existe." };
  }
  if (
    patch.intensity !== undefined &&
    (!Number.isInteger(patch.intensity) || patch.intensity < 1 || patch.intensity > 5)
  ) {
    return { error: "La intensidad va del 1 al 5." };
  }
  if (
    patch.note !== undefined &&
    patch.note !== null &&
    (typeof patch.note !== "string" || patch.note.length > MAX_NOTA)
  ) {
    return { error: "La nota es demasiado larga." };
  }

  const { data: existing } = await supabase
    .from("journal_entries")
    .select("mood, intensity, note")
    .eq("user_id", user.id)
    .eq("entry_date", fecha)
    .maybeSingle();

  const mood = patch.mood ?? existing?.mood;
  if (!mood) return { error: "Elige cómo te sentiste antes de guardar la nota." };

  const { error } = await supabase.from("journal_entries").upsert(
    {
      user_id: user.id,
      entry_date: fecha,
      mood,
      intensity: patch.intensity ?? existing?.intensity ?? 3,
      note: patch.note !== undefined ? patch.note : (existing?.note ?? null),
    },
    { onConflict: "user_id,entry_date" },
  );

  if (error) return { error: error.message };

  revalidatePath("/hoy");
  revalidatePath("/bitacora");
  // La línea de ánimo vive en Progreso.
  revalidatePath("/progreso");
  return { error: null };
}
