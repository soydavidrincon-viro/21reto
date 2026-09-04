"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { esZonaValida } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { COMPANION_KEYS, type Profile } from "@/lib/types";

export type Theme = "system" | "light" | "dark";

const THEMES: Theme[] = ["system", "light", "dark"];

/**
 * El tema se guarda en el perfil y además en una cookie.
 *
 * La cookie no es redundante: es lo que lee el script en línea del layout raíz
 * para estampar `data-theme` en el `<html>` antes del primer pintado. Sin ella
 * la página saldría con el tema del sistema y cambiaría de golpe al cargar,
 * que es el parpadeo blanco clásico de las apps oscuras.
 *
 * El perfil es la copia que viaja entre dispositivos; la cookie es la copia
 * rápida de este navegador.
 */
export async function setTheme(theme: Theme) {
  if (!THEMES.includes(theme)) return { error: "Ese tema no existe." };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  const { error } = await supabase
    .from("profiles")
    .update({ theme })
    .eq("id", user.id);

  if (error) return { error: error.message };

  const store = await cookies();
  store.set("theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    // Explícito porque de esto depende todo lo demás: el script del layout la
    // lee con `document.cookie`, y con httpOnly la cookie existiría pero sería
    // invisible desde JavaScript. El tema volvería a parpadear.
    httpOnly: false,
  });

  // Sin revalidatePath: el tema ya no cambia nada de lo que renderiza el
  // servidor, así que tirar la caché de rutas solo obligaría a volver a
  // construir la portada y el login para producir el mismo HTML.
  return { error: null };
}

/** Guarda la url de la foto, o la quita si llega null. */
export async function setAvatar(url: string | null) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  // Solo fotos que subió esta cuenta a su carpeta del bucket. Sin esto, la
  // columna aceptaba cualquier URL, y una URL ajena en un `<img>` de la app es
  // una forma de meter contenido que nadie subió.
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatares/${user.id}/`;
  if (url !== null && !url.startsWith(base)) {
    return { error: "Esa foto no es de esta cuenta." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

/**
 * Lo que la persona puede cambiar de su perfil desde Ajustes.
 *
 * Se copia campo a campo y no se pasa el objeto entero al `update`: una acción
 * de servidor la puede llamar cualquiera con sesión mandando lo que quiera, y
 * antes eso llegaba tal cual a Postgres. La zona horaria además se comprueba,
 * porque una inválida no rompe una fila: rompe cada pantalla que calcula qué
 * día es hoy.
 */
export async function updateProfile(patch: {
  display_name?: string;
  timezone?: string;
  companion?: Profile["companion"];
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  const cambios: Partial<Pick<Profile, "display_name" | "timezone" | "companion">> = {};

  if (patch.display_name !== undefined) {
    if (typeof patch.display_name !== "string" || patch.display_name.length > 60) {
      return { error: "El nombre es demasiado largo." };
    }
    cambios.display_name = patch.display_name.trim() || null;
  }

  if (patch.timezone !== undefined) {
    if (!esZonaValida(patch.timezone)) {
      return { error: "Esa zona horaria no existe." };
    }
    cambios.timezone = patch.timezone;
  }

  if (patch.companion !== undefined) {
    if (!COMPANION_KEYS.includes(patch.companion)) {
      return { error: "Ese compañero no existe." };
    }
    cambios.companion = patch.companion;
  }

  if (Object.keys(cambios).length === 0) return { error: null };

  const { error } = await supabase.from("profiles").update(cambios).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

/** Todo lo que la persona ha escrito, en un JSON que se puede leer sin la app. */
export async function exportData() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión.", data: null };

  const [profile, habits, logs, journal, cravings] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("habits").select("*").order("created_at"),
    supabase.from("habit_logs").select("*").order("log_date"),
    supabase.from("journal_entries").select("*").order("entry_date"),
    supabase.from("cravings").select("*").order("logged_at"),
  ]);

  return {
    error: null,
    data: {
      exportado_el: new Date().toISOString(),
      perfil: profile.data,
      habitos: habits.data ?? [],
      registros: logs.data ?? [],
      bitacora: journal.data ?? [],
      impulsos: cravings.data ?? [],
    },
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function deleteAccount() {
  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  redirect("/");
}
