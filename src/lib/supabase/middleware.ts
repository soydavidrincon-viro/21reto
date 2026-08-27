import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rutas que se pueden ver sin sesión. */
const PUBLIC_PATHS = ["/", "/login", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * ¿Hay siquiera una cookie de sesión?
 *
 * `@supabase/ssr` la guarda como `sb-<ref>-auth-token`, y si pasa del tamaño
 * máximo la parte en `.0`, `.1`. Sin ninguna de ellas no hay sesión posible, y
 * preguntárselo al servidor de auth es gastar una ida y vuelta por red para que
 * conteste lo que ya sabíamos.
 */
function traeCookieDeSesion(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
}

/**
 * Cuánto se espera al servidor de auth antes de seguir sin él.
 *
 * Existe por algo que pasó de verdad: el proyecto de Supabase se enfrió, las
 * peticiones a auth empezaron a tardar veinte segundos, y como esta función
 * corre en *cada* request, no solo se cayó el login — se cayó la app entera.
 * Cada página quedaba colgada esperando aquí.
 *
 * Al agotarse el plazo dejamos pasar la petición en vez de redirigir al login:
 * la página que hay detrás vuelve a comprobar la sesión y redirige ella si hace
 * falta, así que no se abre ningún agujero. Lo que se evita es echar a alguien
 * que sí tenía sesión solo porque el servidor tardó.
 */
const ESPERA_MAXIMA_MS = 3000;

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // Sin cookie no hay sesión que refrescar ni nada que preguntar.
  if (!traeCookieDeSesion(request)) {
    if (isPublic(pathname)) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() y no getSession(): valida el token contra el servidor de auth en
  // vez de confiar en lo que traiga la cookie.
  const consulta = supabase.auth.getUser().then(({ data }) => data.user);
  const plazo = new Promise<"tardo">((resolve) =>
    setTimeout(() => resolve("tardo"), ESPERA_MAXIMA_MS),
  );

  const resultado = await Promise.race([consulta, plazo]).catch(() => "tardo");

  // El servidor de auth no contestó a tiempo. Que pase y decida la página.
  if (resultado === "tardo") return response;

  const user = resultado;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/" || pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/hoy";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
