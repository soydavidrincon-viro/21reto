import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";

/**
 * El que manda los recordatorios.
 *
 * Lo llama `pg_cron` desde Supabase cada hora. No va en un cron de Vercel
 * porque el plan gratis solo permite uno al día, y con uno al día no se puede
 * respetar la hora de cada quien.
 *
 * Aquí no se decide nada: a quién le toca y por qué lo resuelve
 * `avisos_pendientes()` en SQL, al lado del dato y con la zona horaria de cada
 * perfil. Esto solo cifra, manda y anota.
 */

// Node y no Edge: `web-push` necesita el crypto de Node para cifrar el payload.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEXTOS: Record<
  string,
  (habito: string | null, dato: number) => { title: string; body: string; url: string }
> = {
  hora_dificil: () => ({
    title: "Suele darte por aquí",
    body: "A esta hora y este día es cuando más veces te ha pasado. Ya lo sabes, que no te agarre desprevenido.",
    url: "/hoy",
  }),
  racha: (habito, dato) => ({
    title: `Llevas ${dato} días`,
    body: `Todavía no marcaste ${habito ?? "hoy"}. Un toque y el día queda cerrado.`,
    url: "/hoy",
  }),
  hito: (habito) => ({
    title: "Mañana llegas",
    body: `Un día más y cumples tu meta con ${habito ?? "tu reto"}.`,
    url: "/hoy",
  }),
  dia: () => ({
    title: "¿Cómo te fue hoy?",
    body: "Marca tus hábitos y cuéntalo en dos líneas mientras lo tienes fresco.",
    url: "/hoy",
  }),
};

type Aviso = {
  user_id: string;
  kind: string;
  local_date: string;
  habito: string | null;
  dato: number;
};

export async function POST(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;

  // La puerta va primero y sin excepciones: este endpoint puede leer y
  // notificar a toda la base. Sin secreto configurado no se puede autenticar a
  // nadie, así que se cierra entero y sin dar detalles.
  if (!secreto) {
    return NextResponse.json({ error: "sin configurar" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "no" }, { status: 401 });
  }

  /*
   * Y solo después, qué más falta — con nombres.
   *
   * Antes esto iba antes de la puerta y devolvía un "sin configurar" pelado a
   * cualquiera que preguntara sin contraseña. Dos problemas: le contaba a un
   * desconocido en qué estado está el servidor, y a quien sí tenía la
   * contraseña no le decía cuál de las cinco variables faltaba. Nos costó media
   * hora de adivinar. Los nombres de las variables no son secretos; sus valores
   * sí, y esos no salen de aquí.
   */
  const config = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const faltan = Object.entries(config)
    .filter(([, valor]) => !valor)
    .map(([nombre]) => nombre);

  if (faltan.length > 0) {
    return NextResponse.json(
      {
        error: "sin configurar",
        faltan,
        pista:
          "Añádelas en Vercel y vuelve a desplegar: las variables se leen al construir.",
      },
      { status: 500 },
    );
  }

  const publica = config.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
  const privada = config.VAPID_PRIVATE_KEY!;
  const url = config.NEXT_PUBLIC_SUPABASE_URL!;
  const servicio = config.SUPABASE_SERVICE_ROLE_KEY!;

  // Sin sesión de usuario: la clave de servicio se salta la RLS a propósito,
  // porque hay que mirar a todo el mundo para saber a quién le toca. Es la
  // única parte del proyecto que la usa, y solo vive aquí.
  const supabase = createClient(url, servicio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("avisos_pendientes");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const avisos = (data ?? []) as Aviso[];

  // `dry` permite ver a quién se le mandaría sin mandar nada. Existe para poder
  // depurar esto sin despertar a nadie a las tres de la mañana.
  const seco = request.nextUrl.searchParams.get("dry") === "1";
  if (seco) {
    return NextResponse.json({
      seco: true,
      total: avisos.length,
      avisos: avisos.map((a) => ({ kind: a.kind, habito: a.habito, dato: a.dato })),
    });
  }

  webpush.setVapidDetails("mailto:hola@antidoto.app", publica, privada);

  let enviados = 0;
  let caducados = 0;

  for (const aviso of avisos) {
    const plantilla = TEXTOS[aviso.kind];
    if (!plantilla) continue;

    const { data: dispositivos } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", aviso.user_id);

    if (!dispositivos?.length) continue;

    const cuerpo = JSON.stringify(plantilla(aviso.habito, aviso.dato));
    let algunoLlego = false;

    for (const d of dispositivos) {
      try {
        await webpush.sendNotification(
          {
            endpoint: d.endpoint as string,
            keys: { p256dh: d.p256dh as string, auth: d.auth as string },
          },
          cuerpo,
        );
        algunoLlego = true;
      } catch (fallo) {
        const status = (fallo as { statusCode?: number }).statusCode;
        // 404 y 410 significan que ese dispositivo ya no existe: la persona
        // desinstaló la app o revocó el permiso. Guardarlo para siempre es
        // acumular basura que se reintenta cada hora.
        if (status === 404 || status === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", d.endpoint as string);
          caducados += 1;
        }
      }
    }

    // Se anota aunque no haya llegado a ningún dispositivo. El registro es el
    // tope de "uno al día": si se apuntara solo al acertar, un fallo de red
    // dejaría a alguien recibiendo un intento cada hora.
    await supabase.from("notification_log").insert({
      user_id: aviso.user_id,
      local_date: aviso.local_date,
      kind: aviso.kind,
    });

    if (algunoLlego) enviados += 1;
  }

  return NextResponse.json({ candidatos: avisos.length, enviados, caducados });
}
