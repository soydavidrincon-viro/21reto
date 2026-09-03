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
  /**
   * Días de la semana en que toca, 0 = domingo. Los hábitos que se dejan
   * mandan siempre los siete.
   */
  activeDows: number[];
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

  // Se limpia aquí y no se confía en lo que llegue: el esquema también lo
  // comprueba, pero un array vacío que llegue hasta allá vuelve como un error
  // de Postgres, y eso no es un mensaje para nadie.
  const dows = [...new Set(input.activeDows)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);
  if (dows.length === 0) {
    return { error: "Elige al menos un día de la semana." };
  }

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
    active_dows: dows,
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
 * Cambiar los días en que toca un hábito.
 *
 * No se toca ningún registro: los días ya marcados siguen contando. Lo que
 * cambia es de aquí en adelante, y también hacia atrás en el cálculo de la
 * racha, porque la racha se cuenta sobre los días en que toca y esos acaban de
 * cambiar. Es el comportamiento correcto: si alguien pasa de todos los días a
 * lunes, miércoles y viernes, su racha refleja el hábito que tiene ahora, no el
 * que tenía.
 */
export async function setHabitDows(habitId: string, dows: number[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  const limpios = [...new Set(dows)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);

  if (limpios.length === 0) {
    return { error: "Elige al menos un día de la semana." };
  }

  const { error } = await supabase
    .from("habits")
    .update({ active_dows: limpios })
    .eq("id", habitId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/hoy");
  revalidatePath(`/habito/${habitId}`);
  return { error: null };
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

/**
 * Borrar un reto de verdad, con todo lo que cuelga de él.
 *
 * Existe porque no existía, y eso dejaba la app inservible para lo primero que
 * hace cualquiera: crear tres o cuatro retos de prueba antes de poner el de
 * verdad. `archiveHabit` estaba escrito desde el principio pero su única puerta
 * era la tarjeta de reto cumplido, así que un hábito que nunca se completó no
 * había forma de quitarlo.
 *
 * Las dos opciones no son la misma y por eso conviven: archivar conserva el
 * historial y solo lo saca de Hoy —sirve para algo que ya dejó de ser un reto—,
 * y borrar se lleva los registros y los antojos por la cascada del esquema.
 * Para lo que se creó por error, archivar sería dejar basura para siempre.
 */
export async function deleteHabit(habitId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  // La política RLS ya limita el borrado a lo propio; el filtro por user_id es
  // el segundo cerrojo, para que un fallo de política no baste por sí solo.
  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", habitId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/hoy");
  revalidatePath("/progreso");
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
