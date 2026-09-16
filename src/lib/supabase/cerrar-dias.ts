import type { createClient } from "@/lib/supabase/server";

/**
 * Cierra como recaída asumida los días que tocaban y quedaron sin marcar
 * (migración 0014). Se llama al abrir Hoy, Bitácora y el detalle: sin la
 * persona no hay zona horaria fiable ni "hoy", así que no es un cron.
 *
 * Si falla, la pantalla sigue: es peor dejar a alguien sin Hoy que enseñarle
 * un día gris que debía ser amarillo.
 */
export async function cerrarDiasSinMarcar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  today: string,
): Promise<void> {
  const { error } = await supabase.rpc("cerrar_dias_sin_marcar", {
    p_today: today,
  });
  if (error) console.error("cerrar_dias_sin_marcar:", error.message);
}
