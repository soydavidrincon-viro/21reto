"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Theme = "system" | "light" | "dark";

/**
 * El tema se guarda en el perfil y además en una cookie.
 *
 * La cookie no es redundante: el layout raíz la lee para estampar `data-theme`
 * en el `<html>` durante el render del servidor. Sin ella la página saldría con
 * el tema del sistema y cambiaría de golpe al hidratar, que es el parpadeo
 * blanco clásico de las apps oscuras.
 */
export async function setTheme(theme: Theme) {
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
  });

  revalidatePath("/", "layout");
  return { error: null };
}

export async function updateProfile(patch: {
  display_name?: string;
  timezone?: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
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

  const [profile, habits, logs, journal] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("habits").select("*").order("created_at"),
    supabase.from("habit_logs").select("*").order("log_date"),
    supabase.from("journal_entries").select("*").order("entry_date"),
  ]);

  return {
    error: null,
    data: {
      exportado_el: new Date().toISOString(),
      perfil: profile.data,
      habitos: habits.data ?? [],
      registros: logs.data ?? [],
      bitacora: journal.data ?? [],
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
