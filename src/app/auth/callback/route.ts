import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino del magic link. Canjea el código por una sesión y manda a la app;
 * si el perfil todavía no tiene zona horaria real, la toma de los metadatos
 * que el login guardó al pedir el enlace.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/hoy";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid_code`);
  }

  const timezone = data.user?.user_metadata?.timezone;
  if (typeof timezone === "string" && timezone.length > 0) {
    await supabase
      .from("profiles")
      .update({ timezone })
      .eq("id", data.user.id)
      .eq("timezone", "UTC");
  }

  return NextResponse.redirect(`${origin}${next}`);
}
