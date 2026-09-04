import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { HabitIcon } from "@/components/habit-icon";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompartirTarjeta } from "@/components/compartir-tarjeta";
import { DiasDelHabito } from "@/components/dias-del-habito";
import { GestionDeReto } from "@/components/gestion-de-reto";
import { HabitActions } from "@/components/habit-actions";
import {
  MonthHeatmap,
  type ImpulsoDelDia,
} from "@/components/month-heatmap";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { usuarioActual } from "@/lib/supabase/sesion";
import type { LogStatus, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

type Stats = {
  clean_days: number;
  relapses: number;
  completion_rate: number;
  current_streak: number;
  best_streak: number;
};

export default async function HabitoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const user = await usuarioActual();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<Profile, "timezone">>();

  const today = todayIn(profile?.timezone ?? "UTC");

  const [{ data: habit }, { data: statsRows }, { data: logs }, { data: impulsos }] =
    await Promise.all([
      supabase.from("habits").select("*").eq("id", id).maybeSingle(),
      supabase.rpc("get_habit_stats", { p_habit_id: id, p_today: today }),
      // Sin filtro de fecha, y por eso el calendario puede navegar meses sin
      // volver a consultar: el histórico entero ya está aquí.
      supabase
        .from("habit_logs")
        .select("log_date, status, note")
        .eq("habit_id", id),
      supabase
        .from("cravings")
        .select("local_date, local_hour, intensity, trigger_key, resisted, note")
        .eq("habit_id", id),
    ]);

  if (!habit) notFound();

  const stats = ((statsRows ?? []) as Stats[])[0] ?? {
    clean_days: 0,
    relapses: 0,
    completion_rate: 0,
    current_streak: 0,
    best_streak: 0,
  };

  const byDate = new Map<string, LogStatus>(
    (logs ?? []).map((log) => [log.log_date as string, log.status as LogStatus]),
  );

  const notas = Object.fromEntries(
    (logs ?? [])
      .filter((log) => (log.note as string | null)?.trim())
      .map((log) => [log.log_date as string, log.note as string]),
  );

  const todayStatus = byDate.get(today) ?? null;

  return (
    <div className="flex flex-col gap-3.5">
      {/* La barra pegajosa con el título centrado es un patrón de teléfono. En
          escritorio el carril lateral ya dice dónde estás, así que sobra: queda
          solo el enlace de vuelta y el nombre pasa a ser un título de verdad. */}
      <header className="sticky top-0 z-10 flex h-11 items-center justify-between gap-2 border-b border-separator bg-bar px-3 backdrop-blur-xl lg:static lg:mx-0 lg:h-auto lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
        <Link
          href="/hoy"
          className="inline-flex shrink-0 items-center gap-0.5 text-[17px] tracking-[-0.02em] text-azul focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul lg:text-[14px] lg:font-semibold"
        >
          <CaretLeft size={18} weight="bold" aria-hidden="true" />
          Hoy
        </Link>
        <h1 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-label lg:hidden">
          {habit.name}
        </h1>
        {/* Archivar y eliminar viven aquí, del tamaño de un icono. Antes eran
            una tarjeta abierta al pie con "Eliminar" en rojo a la vista: las
            dos únicas acciones sin vuelta atrás de la pantalla eran también las
            que más sitio ocupaban. */}
        <GestionDeReto habitId={habit.id} nombre={habit.name} />
      </header>

      <h1 className="hidden font-display text-[30px] font-semibold leading-none tracking-[-0.01em] text-label lg:block">
        {habit.name}
      </h1>

      <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[1fr_1.15fr] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-3.5">
          <section className="mx-4 flex flex-col items-center gap-2 rounded-[22px] bg-card px-4 py-6 lg:mx-0 lg:py-8">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-naranja text-naranja-tinta">
              <HabitIcon clave={habit.icon} size={30} />
            </span>
            <p className="flex items-baseline gap-2">
              <span className="tnum font-display text-[46px] font-bold leading-none tracking-[-0.04em] text-naranja">
                {stats.current_streak}
              </span>
              <span className="text-[15px] font-semibold text-label-2">
                {stats.current_streak === 1 ? "día de racha" : "días de racha"}
              </span>
            </p>
            <span className="text-[13px] tracking-[-0.01em] text-label-2">
              Meta de {habit.target_days} días · {stats.clean_days} limpios
            </span>
          </section>

          <section className="mx-4 flex rounded-[22px] bg-card px-1.5 py-3.5 lg:mx-0 lg:py-4">
            {[
              [stats.clean_days, "Días limpios"],
              [stats.best_streak, "Mejor racha"],
              [`${stats.completion_rate}%`, "Cumplimiento"],
              [stats.relapses, stats.relapses === 1 ? "Recaída" : "Recaídas"],
            ].map(([value, label]) => (
              <div
                key={String(label)}
                className="flex w-full flex-col items-center gap-0.5"
              >
                <b className="tnum font-display text-[22px] font-bold tracking-[-0.03em] text-label">
                  {value}
                </b>
                <small className="text-center text-[11.5px] tracking-[-0.01em] text-label-2">
                  {label}
                </small>
              </div>
            ))}
          </section>

          <HabitActions
            habitId={habit.id}
            today={today}
            todayStatus={todayStatus}
          />

          {/* Solo en lo que se construye: lo que se deja se deja todos los
              días, y ofrecer días libres ahí sería ofrecer una excusa con
              forma de ajuste. */}
          {habit.kind === "build" && (
            <div className="mx-4 lg:mx-0">
              <DiasDelHabito
                habitId={habit.id}
                inicial={habit.active_dows ?? [0, 1, 2, 3, 4, 5, 6]}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <section className="mx-4 flex flex-col gap-3 rounded-[22px] bg-card px-3.5 py-4 lg:mx-0 lg:px-5 lg:py-5">
            <MonthHeatmap
              habitId={habit.id}
              today={today}
              startDate={habit.start_date as string}
              initial={Object.fromEntries(byDate)}
              notas={notas}
              impulsos={(impulsos ?? []) as ImpulsoDelDia[]}
            />

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5 text-[11.5px] tracking-[-0.01em] text-label-2">
                <span className="size-2.5 rounded-[3px] bg-azul" />
                Limpio
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] tracking-[-0.01em] text-label-2">
                <span className="size-2.5 rounded-[3px] bg-ambar" />
                Recaída
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] tracking-[-0.01em] text-label-2">
                <span className="size-[5px] rounded-full bg-naranja" />
                Hubo impulsos
              </span>
            </div>

            <p className="text-[12px] leading-[1.35] text-label-2">
              Toca un día para ver qué pasó, o para corregirlo si se te olvidó
              marcarlo.
            </p>
          </section>

          {/* Compartir va debajo del calendario y no en medio de la columna de
              números: se comparte cuando ya se ha visto lo que se lleva hecho,
              no antes. */}
          <div className="mx-4 lg:mx-0">
            <CompartirTarjeta habitId={habit.id} nombre={habit.name} />
          </div>
        </div>
      </div>
    </div>
  );
}
