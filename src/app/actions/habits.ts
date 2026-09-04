"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { esZonaValida, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import {
  COMPANION_KEYS,
  HABIT_COLORS,
  MAX_MOTIVO,
  MAX_TARGET_DAYS,
  type HabitColor,
  type Profile,
} from "@/lib/types";

/**
 * ¿Falló porque la base todavía no tiene la columna de los días?
 *
 * Llega de dos formas según quién se queje. Postgres devuelve 42703
 * ("column does not exist"); PostgREST, que es quien está delante, corta antes
 * con PGRST204 y su propio texto — "Could not find the 'active_dows' column of
 * 'habits' in the schema cache"—. Mirar solo el de Postgres no servía de nada,
 * porque la petición nunca llega tan abajo.
 *
 * Existe por un error de despliegue mío: el código salió antes que la
 * migración, y durante esa ventana crear un hábito devolvía ese texto en rojo
 * debajo del botón. Se queda como red de seguridad para la próxima.
 */
function faltaLaColumnaDeDias(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    (error.message ?? "").includes("active_dows")
  );
}

/** Los días de la semana limpios: sin repetidos, sin nada fuera de 0..6. */
function limpiarDias(dows: unknown): number[] {
  if (!Array.isArray(dows)) return [];
  return [...new Set(dows)]
    .filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);
}

function metaValida(dias: unknown): dias is number {
  return Number.isInteger(dias) && (dias as number) >= 1 && (dias as number) <= MAX_TARGET_DAYS;
}

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
  /** Para qué lo hace, en sus palabras. Opcional. */
  motivo?: string;
};

/** El "por qué" limpio, o null si no vino. Devuelve undefined si no vale. */
function limpiarMotivo(motivo: unknown): string | null | undefined {
  if (motivo === undefined || motivo === null) return null;
  if (typeof motivo !== "string") return undefined;
  const limpio = motivo.trim();
  if (limpio.length > MAX_MOTIVO) return undefined;
  return limpio || null;
}

export async function createHabit(input: NewHabit) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return { error: "Ponle un nombre al hábito." };
  if (name.length > 80) return { error: "El nombre es demasiado largo." };

  /*
   * Todo lo que tiene lista cerrada se comprueba aquí, antes de Postgres. El
   * esquema lo rechazaría igual, pero con un texto en inglés y nombres de
   * columna que acabarían en rojo debajo del botón.
   */
  if (input.kind !== "quit" && input.kind !== "build") {
    return { error: "Elige si quieres dejar algo o empezar algo." };
  }
  if (!HABIT_COLORS.includes(input.color)) return { error: "Ese color no existe." };
  if (input.relapsePolicy !== "reset" && input.relapsePolicy !== "continue") {
    return { error: "Elige qué pasa si tienes una recaída." };
  }
  if (!metaValida(input.targetDays)) {
    return { error: `La meta va de 1 a ${MAX_TARGET_DAYS} días.` };
  }
  const icon =
    typeof input.icon === "string" && input.icon.length > 0 && input.icon.length <= 32
      ? input.icon
      : "otro";
  const motivo = limpiarMotivo(input.motivo);
  if (motivo === undefined) {
    return { error: `El porqué cabe en ${MAX_MOTIVO} caracteres.` };
  }

  // Un array vacío que llegue hasta Postgres vuelve como un error de CHECK, y
  // eso no es un mensaje para nadie.
  const dows = limpiarDias(input.activeDows);
  if (dows.length === 0) {
    return { error: "Elige al menos un día de la semana." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<Profile, "timezone">>();

  // Solo se siembra si el perfil sigue en el valor por defecto: si la persona
  // ya la corrigió a mano en Perfil, el navegador no debe pisarla. Y solo si
  // es una zona de verdad: con una inventada, cada pantalla daría 500.
  let zone = profile?.timezone ?? "UTC";
  if (zone === "UTC" && esZonaValida(input.timezone) && input.timezone !== "UTC") {
    const { error } = await supabase
      .from("profiles")
      .update({ timezone: input.timezone })
      .eq("id", user.id);
    if (!error) zone = input.timezone;
  }

  // El reto arranca hoy según el reloj del usuario, no el del servidor.
  const startDate = todayIn(zone);

  const base = {
    user_id: user.id,
    name,
    kind: input.kind,
    icon,
    color: input.color,
    target_days: input.targetDays,
    relapse_policy: input.relapsePolicy,
    start_date: startDate,
    description: motivo,
  };

  let { error } = await supabase
    .from("habits")
    .insert({ ...base, active_dows: dows });

  // Si la migración de los días todavía no está aplicada, se reintenta sin
  // ellos: el hábito nace tocando todos los días, que es como se ha comportado
  // la app siempre. Crear un hábito es lo primero que hace cualquiera y no
  // puede quedarse roto por una columna que aún no existe.
  if (faltaLaColumnaDeDias(error)) {
    ({ error } = await supabase.from("habits").insert(base));
  }

  if (error) return { error: error.message };

  if (input.finishOnboarding) {
    const companion = COMPANION_KEYS.find((c) => c === input.companion);
    await supabase
      .from("profiles")
      .update({
        onboarded_at: new Date().toISOString(),
        ...(companion ? { companion } : {}),
      })
      .eq("id", user.id);
  }

  revalidatePath("/hoy");
  revalidatePath("/progreso");
  // Al terminar el onboarding se pasa por la pantalla de instalar: en iPhone
  // los avisos solo llegan con la app en la pantalla de inicio, y ese es el
  // momento en que alguien está dispuesto a hacerlo. La pantalla misma decide
  // si tiene algo que decir o manda a Hoy.
  redirect(input.finishOnboarding ? "/instalar" : "/hoy");
}

/**
 * Cambiar o quitar el "por qué" de un hábito.
 *
 * Se guarda en `description`, la columna que el esquema tenía desde el
 * principio y nadie usaba.
 */
export async function setHabitMotivo(habitId: string, motivo: string | null) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  const limpio = limpiarMotivo(motivo);
  if (limpio === undefined) {
    return { error: `El porqué cabe en ${MAX_MOTIVO} caracteres.` };
  }

  const { error } = await supabase
    .from("habits")
    .update({ description: limpio })
    .eq("id", habitId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/hoy");
  revalidatePath(`/habito/${habitId}`);
  return { error: null };
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

  const limpios = limpiarDias(dows);
  if (limpios.length === 0) {
    return { error: "Elige al menos un día de la semana." };
  }

  const { error } = await supabase
    .from("habits")
    .update({ active_dows: limpios })
    .eq("id", habitId)
    .eq("user_id", user.id);

  // Aquí no hay reintento posible: sin la columna, esto es justo lo que no se
  // puede guardar. Pero el texto crudo de PostgREST no le dice nada a nadie.
  if (faltaLaColumnaDeDias(error)) {
    return { error: "Esto todavía no está disponible. Vuelve a intentarlo en un rato." };
  }

  if (error) return { error: error.message };

  revalidatePath("/hoy");
  revalidatePath("/progreso");
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

  // El tope es el del esquema. Antes aquí se aceptaba hasta 3650 y Postgres
  // cortaba en 365 con su propio texto.
  if (!metaValida(nuevaMeta)) {
    return { error: `La meta va de 1 a ${MAX_TARGET_DAYS} días.` };
  }

  const { data: actual } = await supabase
    .from("habits")
    .select("target_days")
    .eq("id", habitId)
    .eq("user_id", user.id)
    .maybeSingle<{ target_days: number }>();

  if (!actual) return { error: "No encontramos ese hábito." };
  if (nuevaMeta <= actual.target_days) {
    return { error: "La meta nueva tiene que ser mayor que la de ahora." };
  }

  const { error } = await supabase
    .from("habits")
    .update({ target_days: nuevaMeta })
    .eq("id", habitId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/hoy");
  revalidatePath("/progreso");
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
 * y borrar se lleva los registros y los impulsos por la cascada del esquema.
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
  revalidatePath("/bitacora");
  redirect("/hoy");
}

export async function archiveHabit(habitId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión." };

  // Mismo doble cerrojo que al borrar.
  const { error } = await supabase
    .from("habits")
    .update({ status: "archived" })
    .eq("id", habitId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/hoy");
  revalidatePath("/progreso");
  redirect("/hoy");
}
