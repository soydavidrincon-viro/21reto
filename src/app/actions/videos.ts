"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_VIDEOS_POR_HABITO, normalizarEnlace } from "@/lib/videos";

/**
 * Guardar un video en un hábito.
 *
 * El enlace se valida dos veces y no es paranoia repetida: aquí, para poder
 * devolver un mensaje que se entienda, y en el `check` de la tabla, que es el
 * que sigue en pie si alguien llama a la base sin pasar por esta función. Lo
 * que se está impidiendo es que un `javascript:` acabe en un `href` que la app
 * pinta como enlace.
 */
export async function addHabitVideo(habitId: string, url: string, title: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  const limpio = normalizarEnlace(url);
  if (!limpio) {
    return { error: "Pega un enlace que empiece por http:// o https://" };
  }

  const nombre = title.trim().slice(0, 120);

  // El tope existe para que la lista siga siendo una lista. No es un límite de
  // seguridad —la RLS ya impide tocar lo ajeno— así que vive aquí y no en el
  // esquema, donde sería una migración cada vez que cambie de idea.
  const { count } = await supabase
    .from("habit_videos")
    .select("id", { count: "exact", head: true })
    .eq("habit_id", habitId);

  if ((count ?? 0) >= MAX_VIDEOS_POR_HABITO) {
    return {
      error: `Caben ${MAX_VIDEOS_POR_HABITO} videos por hábito. Quita alguno para agregar otro.`,
    };
  }

  const { error } = await supabase.from("habit_videos").insert({
    user_id: user.id,
    habit_id: habitId,
    url: limpio,
    title: nombre || null,
  });

  // La llave compuesta (habit_id, user_id) rebota el intento de colgar un video
  // del hábito de otra persona. Llega como error de llave foránea, que dicho
  // tal cual no le sirve a nadie.
  if (error) {
    return {
      error: error.code === "23503"
        ? "Ese hábito no es tuyo."
        : error.message,
    };
  }

  revalidatePath(`/habito/${habitId}`);
  return { error: null };
}

export async function deleteHabitVideo(videoId: string, habitId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  // Doble cerrojo, igual que en deleteHabit: la política RLS ya limita el
  // borrado a lo propio, y el filtro por user_id hace que un fallo de política
  // no baste por sí solo.
  const { error } = await supabase
    .from("habit_videos")
    .delete()
    .eq("id", videoId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/habito/${habitId}`);
  return { error: null };
}
