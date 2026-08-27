import { headers } from "next/headers";
import { CABECERA_EMAIL, CABECERA_USUARIO } from "./cabeceras";
import { createClient } from "./server";

export type Sesion = { id: string; email: string | null };

/**
 * Quién está entrando, sin volver a preguntárselo al servidor de auth.
 *
 * El middleware ya validó el token contra Supabase y dejó el id en una
 * cabecera. Antes cada página repetía ese viaje por su cuenta, o sea dos idas y
 * vueltas por red por pantalla — y con auth lento eso se nota en cada toque de
 * pestaña.
 *
 * Si la cabecera no está, la comprobación se hace entera aquí. Eso pasa cuando
 * el middleware se quedó sin plazo esperando a auth, y es a propósito: el peor
 * caso de esta optimización es exactamente el comportamiento de antes, nunca
 * dejar pasar a alguien sin validar.
 */
export async function usuarioActual(): Promise<Sesion | null> {
  const cabeceras = await headers();
  const id = cabeceras.get(CABECERA_USUARIO);

  if (id) return { id, email: cabeceras.get(CABECERA_EMAIL) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { id: user.id, email: user.email ?? null } : null;
}
