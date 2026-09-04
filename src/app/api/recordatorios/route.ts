import { timingSafeEqual } from "node:crypto";
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
 * perfil. Esto solo anota, cifra y manda — en ese orden, y el orden importa.
 */

// Node y no Edge: `web-push` necesita el crypto de Node para cifrar el payload.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cuántos envíos van a la vez. Google y Apple aguantan de sobra; Vercel tiene reloj. */
const EN_PARALELO = 25;

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

type Dispositivo = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Comparación en tiempo constante. Con `!==` el tiempo de respuesta depende de
 * cuántos caracteres coinciden desde el principio, y eso es una pista que no
 * hace falta regalar en un endpoint que puede notificar a toda la base.
 */
function mismoSecreto(recibido: string | null, esperado: string): boolean {
  if (!recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(`Bearer ${esperado}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;

  // La puerta va primero y sin excepciones: este endpoint puede leer y
  // notificar a toda la base. Sin secreto configurado no se puede autenticar a
  // nadie, así que se cierra entero y sin dar detalles.
  if (!secreto) {
    return NextResponse.json({ error: "sin configurar" }, { status: 500 });
  }
  if (!mismoSecreto(request.headers.get("authorization"), secreto)) {
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

  const avisos = ((data ?? []) as Aviso[]).filter((a) => TEXTOS[a.kind]);

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

  if (avisos.length === 0) {
    return NextResponse.json({ candidatos: 0, enviados: 0, caducados: 0 });
  }

  /*
   * Primero se anota, después se manda.
   *
   * Al revés —mandar y luego anotar— dos corridas solapadas del cron (un
   * reintento, un `curl` a mano, una hora lenta que pisa a la siguiente) leían
   * las dos la lista vacía, mandaban las dos, y solo la segunda fallaba al
   * anotar. La persona recibía dos avisos, y el fallo del insert ni se miraba.
   *
   * Con la fila puesta antes de enviar y `ignoreDuplicates`, la llave primaria
   * de `notification_log` hace de cerrojo: solo quien consigue insertar manda.
   * Lo que devuelve el insert son justo las filas que entraron.
   */
  const { data: reservados, error: errorLog } = await supabase
    .from("notification_log")
    .upsert(
      avisos.map((a) => ({
        user_id: a.user_id,
        local_date: a.local_date,
        kind: a.kind,
      })),
      { onConflict: "user_id,local_date", ignoreDuplicates: true },
    )
    .select("user_id");

  if (errorLog) {
    return NextResponse.json({ error: errorLog.message }, { status: 500 });
  }

  const conTurno = new Set((reservados ?? []).map((r) => r.user_id as string));
  const aMandar = avisos.filter((a) => conTurno.has(a.user_id));

  // Una sola consulta para todos los dispositivos, no una por persona.
  const { data: dispositivos } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in(
      "user_id",
      aMandar.map((a) => a.user_id),
    );

  const porUsuario = new Map<string, Dispositivo[]>();
  for (const d of (dispositivos ?? []) as Dispositivo[]) {
    const lista = porUsuario.get(d.user_id) ?? [];
    lista.push(d);
    porUsuario.set(d.user_id, lista);
  }

  webpush.setVapidDetails("mailto:hola@antidoto.app", publica, privada);

  const envios: { aviso: Aviso; dispositivo: Dispositivo }[] = [];
  for (const aviso of aMandar) {
    for (const dispositivo of porUsuario.get(aviso.user_id) ?? []) {
      envios.push({ aviso, dispositivo });
    }
  }

  const llegoA = new Set<string>();
  const caducadosEndpoints: string[] = [];

  // Por lotes y en paralelo: en serie, con mil personas a la misma hora, el
  // bucle se pasaba del tiempo máximo de la función y la cola se quedaba a
  // medias en silencio.
  for (let i = 0; i < envios.length; i += EN_PARALELO) {
    const lote = envios.slice(i, i + EN_PARALELO);
    const resultados = await Promise.allSettled(
      lote.map(({ aviso, dispositivo }) =>
        webpush.sendNotification(
          {
            endpoint: dispositivo.endpoint,
            keys: { p256dh: dispositivo.p256dh, auth: dispositivo.auth },
          },
          JSON.stringify(TEXTOS[aviso.kind](aviso.habito, aviso.dato)),
        ),
      ),
    );

    resultados.forEach((resultado, n) => {
      const { aviso, dispositivo } = lote[n];
      if (resultado.status === "fulfilled") {
        llegoA.add(aviso.user_id);
        return;
      }
      const status = (resultado.reason as { statusCode?: number }).statusCode;
      // 404 y 410 significan que ese dispositivo ya no existe: la persona
      // desinstaló la app o revocó el permiso. Guardarlo para siempre es
      // acumular basura que se reintenta cada hora.
      if (status === 404 || status === 410) {
        caducadosEndpoints.push(dispositivo.endpoint);
      }
    });
  }

  if (caducadosEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", caducadosEndpoints);
  }

  return NextResponse.json({
    candidatos: avisos.length,
    enviados: llegoA.size,
    caducados: caducadosEndpoints.length,
  });
}
