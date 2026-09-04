import { NextResponse, type NextRequest } from "next/server";
import { esZonaValida } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_DESTINO, destinoSeguro } from "@/lib/supabase/destino";

/**
 * Destino del magic link y del retorno de Google. Canjea el código por una
 * sesión y manda a la app; si el perfil todavía no tiene zona horaria real, la
 * toma de los metadatos que el login guardó al pedir el enlace.
 *
 * A dónde mandar después lo dice una cookie que dejó el login, no la URL. La
 * URL de retorno tiene que coincidir exactamente con la lista blanca de
 * Supabase, así que no puede llevar el destino colgado; y una cookie no la
 * puede poner nadie desde fuera con un enlace.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid_code`);
  }

  // Los metadatos los escribe el navegador al pedir el enlace, o sea que son
  // texto de quien sea. Solo entra si es una zona de verdad: una inventada
  // rompe cada pantalla de esa persona, y los recordatorios de todo el mundo.
  const timezone = data.user?.user_metadata?.timezone;
  if (esZonaValida(timezone) && timezone !== "UTC") {
    await supabase
      .from("profiles")
      .update({ timezone })
      .eq("id", data.user.id)
      .eq("timezone", "UTC");
  }

  const destino = destinoSeguro(request.cookies.get(COOKIE_DESTINO)?.value);
  const response = NextResponse.redirect(`${origin}${destino}`);
  response.cookies.delete(COOKIE_DESTINO);
  return response;
}
