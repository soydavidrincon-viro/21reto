"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Guardar el dispositivo y la hora del recordatorio.
 *
 * La suscripción la genera el navegador; aquí solo se guarda contra la cuenta.
 * El endpoint es único en la tabla, así que volver a entrar desde el mismo
 * teléfono actualiza la fila en vez de crear una segunda que recibiría copias
 * del mismo aviso.
 */
export async function guardarDispositivo(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  // Lo que manda el navegador tiene forma conocida; lo que no la tenga no es
  // una suscripción y no se guarda.
  const textos = [sub?.endpoint, sub?.p256dh, sub?.auth];
  if (!textos.every((t) => typeof t === "string" && t.length > 0 && t.length <= 2048)) {
    return { error: "Esa suscripción no es válida." };
  }
  if (!/^https:\/\//.test(sub.endpoint)) {
    return { error: "Esa suscripción no es válida." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: typeof sub.userAgent === "string" ? sub.userAgent.slice(0, 200) : null,
    },
    { onConflict: "endpoint" },
  );

  if (error) return { error: error.message };

  revalidatePath("/perfil");
  // La campana de Hoy pinta su estado desde el perfil: sin esto, encender los
  // avisos desde ahí la dejaba gris hasta la siguiente recarga.
  revalidatePath("/hoy");
  return { error: null };
}

export async function olvidarDispositivo(endpoint: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  // Doble cerrojo: la política RLS ya limita el borrado a lo propio, y el
  // filtro por user_id hace que un fallo de política no baste por sí solo.
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/perfil");
  // La campana de Hoy pinta su estado desde el perfil: sin esto, encender los
  // avisos desde ahí la dejaba gris hasta la siguiente recarga.
  revalidatePath("/hoy");
  return { error: null };
}

export type PreferenciasDeAviso = {
  /** Hora local del recordatorio del día. null apaga todos los avisos. */
  reminderHour: number | null;
  avisaRacha: boolean;
  avisaHito: boolean;
  avisaHoraDificil: boolean;
};

export async function guardarAvisos(prefs: PreferenciasDeAviso) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  const hora = prefs.reminderHour;
  if (hora !== null && (!Number.isInteger(hora) || hora < 0 || hora > 23)) {
    return { error: "Esa hora no es válida." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      reminder_hour: hora,
      avisa_racha: prefs.avisaRacha,
      avisa_hito: prefs.avisaHito,
      avisa_hora_dificil: prefs.avisaHoraDificil,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/perfil");
  // La campana de Hoy pinta su estado desde el perfil: sin esto, encender los
  // avisos desde ahí la dejaba gris hasta la siguiente recarga.
  revalidatePath("/hoy");
  return { error: null };
}
