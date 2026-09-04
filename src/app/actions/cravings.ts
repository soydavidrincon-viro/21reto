"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { zonedNow } from "@/lib/dates";
import { TRIGGER_BY_KEY, type Profile } from "@/lib/types";

export type NuevoImpulso = {
  habitId: string | null;
  intensity: number;
  triggerKey: string | null;
  note: string | null;
  /** false = cayó. Además de guardar el impulso, marca la recaída del día. */
  resisted: boolean;
};

/**
 * Registra un impulso.
 *
 * La hora y el día de la semana se calculan aquí con la zona del perfil, no en
 * el navegador ni con el reloj del servidor. Es la misma regla que rige todo lo
 * demás: quien registra a las 23:40 en Ciudad de México tiene un impulso de esa
 * noche, no de la madrugada siguiente en Virginia. Y como el análisis entero
 * cuelga de esa hora, equivocarla no daría un dato feo: daría un dato falso.
 */
export async function logCraving(input: NuevoImpulso) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  if (
    !Number.isInteger(input.intensity) ||
    input.intensity < 1 ||
    input.intensity > 5
  ) {
    return { error: "La intensidad va del 1 al 5." };
  }
  if (input.triggerKey !== null && !TRIGGER_BY_KEY.has(input.triggerKey)) {
    return { error: "Ese disparador no existe." };
  }
  if (input.note !== null && (typeof input.note !== "string" || input.note.length > 500)) {
    return { error: "La nota es demasiado larga." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<Profile, "timezone">>();

  const zone = profile?.timezone ?? "UTC";
  const {
    date: localDate,
    hour: localHour,
    dow: localDow,
  } = zonedNow(zone);

  const { error } = await supabase.from("cravings").insert({
    user_id: user.id,
    habit_id: input.habitId,
    local_date: localDate,
    local_hour: localHour,
    local_dow: localDow,
    intensity: input.intensity,
    trigger_key: input.triggerKey,
    note: input.note?.trim() || null,
    resisted: input.resisted,
  });

  if (error) return { error: error.message };

  // Si cayó y el impulso cuelga de un hábito, la recaída del día se registra
  // sola. Pedirle a alguien que acaba de recaer que además vaya a otra pantalla
  // a marcarlo es pedir demasiado justo en el peor momento.
  if (!input.resisted && input.habitId) {
    await supabase.from("habit_logs").upsert(
      {
        habit_id: input.habitId,
        user_id: user.id,
        log_date: localDate,
        status: "relapse",
      },
      { onConflict: "habit_id,log_date" },
    );
  }

  revalidatePath("/hoy");
  revalidatePath("/progreso");
  // La bitácora lista los impulsos del día, y el detalle del hábito enseña la
  // recaída que acaba de escribirse y el punto naranja en el calendario.
  revalidatePath("/bitacora");
  if (input.habitId) revalidatePath(`/habito/${input.habitId}`);
  return { error: null };
}
