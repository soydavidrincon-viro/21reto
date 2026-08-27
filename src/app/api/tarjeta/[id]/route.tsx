import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { lastNDays, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { comoSeLee, HABIT_HEX, type LogStatus, type Profile } from "@/lib/types";

export const runtime = "nodejs";

const LADO = 1080;

/**
 * Fredoka va empaquetada en el repo, no se baja de Google en cada petición.
 *
 * Es la tipografía de la marca y sin ella la tarjeta sale en la de sistema, que
 * no tiene negrita de verdad: el número grande, que es todo el punto de la
 * imagen, quedaba flaco. Bajarla en caliente ataría una imagen del producto a
 * que un tercero responda. La licencia es SIL OFL, que permite redistribuirla.
 */
const FUENTES = join(process.cwd(), "src/app/api/tarjeta/fuentes");

let cache: { name: string; data: Buffer; weight: 600 | 700; style: "normal" }[] | null = null;

async function fuentes() {
  if (cache) return cache;
  const [semi, bold] = await Promise.all([
    readFile(join(FUENTES, "Fredoka-SemiBold.ttf")),
    readFile(join(FUENTES, "Fredoka-Bold.ttf")),
  ]);
  cache = [
    { name: "Fredoka", data: semi, weight: 600, style: "normal" },
    { name: "Fredoka", data: bold, weight: 700, style: "normal" },
  ];
  return cache;
}

/**
 * La tarjeta que se comparte: un PNG de 1080×1080.
 *
 * Imagen de verdad y no captura de pantalla, porque una captura lleva la barra
 * de estado, el teclado a medio abrir y lo que hubiera arriba. Esto se genera
 * en el servidor y sale igual desde cualquier teléfono.
 *
 * `?nombre=0` la genera sin el nombre del hábito. No es un detalle: alguien que
 * trackea porno, apuestas o pastillas quiere poder enseñar "21 días" sin decir
 * de qué, y sin esa opción la función no le sirve — o peor, la usa y se
 * arrepiente. Nunca es pública: solo existe cuando la persona la pide, y la
 * ruta comprueba la sesión, así que el hábito de nadie más se puede pedir.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<Profile, "timezone">>();

  const today = todayIn(profile?.timezone ?? "UTC");

  // RLS ya limita a lo propio; el maybeSingle solo distingue "no es tuyo" de
  // "no existe" para devolver 404 en vez de una tarjeta en blanco.
  const [{ data: habit }, { data: stats }, { data: logs }] = await Promise.all([
    supabase
      .from("habits")
      .select("name, kind, color, target_days")
      .eq("id", id)
      .maybeSingle<{
        name: string;
        kind: "quit" | "build";
        color: string;
        target_days: number;
      }>(),
    supabase.rpc("get_habit_stats", { p_habit_id: id, p_today: today }),
    supabase
      .from("habit_logs")
      .select("log_date, status")
      .eq("habit_id", id)
      .gte("log_date", lastNDays(today, 28)[0]),
  ]);

  if (!habit) return new Response("No encontrado", { status: 404 });

  const resumen = ((stats ?? []) as { clean_days: number; current_streak: number }[])[0];
  const dias = resumen?.clean_days ?? 0;

  const conNombre = request.nextUrl.searchParams.get("nombre") !== "0";
  const color = HABIT_HEX[habit.color as keyof typeof HABIT_HEX] ?? HABIT_HEX.blue;

  const porFecha = new Map<string, LogStatus>(
    (logs ?? []).map((l) => [l.log_date as string, l.status as LogStatus]),
  );
  const ultimos = lastNDays(today, 28);

  return new ImageResponse(
    (
      <div
        style={{
          width: LADO,
          height: LADO,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: color,
          padding: 84,
          fontFamily: "Fredoka",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* El isotipo, el mismo de src/components/logo.tsx. */}
          <svg width="64" height="64" viewBox="0 0 60 60">
            <rect width="60" height="60" rx="17" fill="rgba(255,255,255,0.24)" />
            <path
              d="M30 12 C 40 22, 45 28, 45 35 a 15 15 0 0 1 -30 0 c 0 -7, 5 -13, 15 -23 Z"
              fill="#FFFFFF"
            />
            <circle cx="30" cy="36" r="6.5" fill={color} />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: -1,
            }}
          >
            Antídoto
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 230,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -14,
            }}
          >
            {dias}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 52,
              fontWeight: 600,
              marginTop: 4,
            }}
          >
            {conNombre ? `días ${comoSeLee(habit.kind, habit.name)}` : "días limpios"}
          </div>
        </div>

        {/* Las últimas cuatro semanas. Cuatro filas de siete: la semana se
            lee sola, y con cinco filas el bloque se salía del cuadrado. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, width: 826 }}>
            {ultimos.map((fecha) => {
              const estado = porFecha.get(fecha);
              return (
                <div
                  key={fecha}
                  style={{
                    width: 106,
                    height: 106,
                    borderRadius: 28,
                    background:
                      estado === "success"
                        ? "rgba(255,255,255,0.95)"
                        : estado === "relapse"
                          ? "rgba(255,255,255,0.45)"
                          : "rgba(0,0,0,0.14)",
                  }}
                />
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              opacity: 0.75,
              marginTop: 8,
            }}
          >
            Un día a la vez
          </div>
        </div>
      </div>
    ),
    { width: LADO, height: LADO, fonts: await fuentes() },
  );
}
