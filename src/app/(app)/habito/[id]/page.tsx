import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { HabitIcon } from "@/components/habit-icon";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompartirTarjeta } from "@/components/compartir-tarjeta";
import { GestionDeReto } from "@/components/gestion-de-reto";
import { HabitActions } from "@/components/habit-actions";
import { MonthHeatmap } from "@/components/month-heatmap";
import { VideosDelHabito } from "@/components/videos-del-habito";
import { monthGrid, monthName, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { usuarioActual } from "@/lib/supabase/sesion";
import type { LogStatus, Profile } from "@/lib/types";
import type { HabitVideo } from "@/lib/videos";

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

  const [{ data: habit }, { data: statsRows }, { data: logs }, { data: videos }] =
    await Promise.all([
      supabase.from("habits").select("*").eq("id", id).maybeSingle(),
      supabase.rpc("get_habit_stats", { p_habit_id: id, p_today: today }),
      supabase.from("habit_logs").select("log_date, status").eq("habit_id", id),
      supabase
        .from("habit_videos")
        .select("id, url, title")
        .eq("habit_id", id)
        .order("created_at", { ascending: true }),
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
    (logs ?? []).map((log) => [
      log.log_date as string,
      log.status as LogStatus,
    ]),
  );

  const grid = monthGrid(today);
  const todayStatus = byDate.get(today) ?? null;

  return (
    <div className="flex flex-col gap-3.5">
      {/* La barra pegajosa con el título centrado es un patrón de teléfono. En
          escritorio el carril lateral ya dice dónde estás, así que sobra: queda
          solo el enlace de vuelta y el nombre pasa a ser un título de verdad. */}
      <header className="sticky top-0 z-10 flex h-11 items-center justify-between border-b border-separator bg-bar px-3 backdrop-blur-xl lg:static lg:mx-0 lg:h-auto lg:flex-col lg:items-start lg:gap-1 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
        <Link
          href="/hoy"
          className="inline-flex items-center gap-0.5 text-[17px] tracking-[-0.02em] text-azul focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul lg:text-[14px] lg:font-semibold"
        >
          <CaretLeft size={18} weight="bold" aria-hidden="true" />
          Hoy
        </Link>
        <h1 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-label lg:font-display lg:text-[30px] lg:leading-none lg:tracking-[-0.01em]">
          {habit.name}
        </h1>
        <span className="w-12 lg:hidden" />
      </header>

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

          {/* Solo en lo que se construye. En un hábito que se deja, la ayuda
              que hace falta es aguantar, y para eso está el botón de
              emergencia; una lista de videos ahí sería relleno. */}
          {habit.kind === "build" && (
            <div className="mx-4 lg:mx-0">
              <VideosDelHabito
                habitId={habit.id}
                videos={(videos ?? []) as HabitVideo[]}
              />
            </div>
          )}

          <div className="mx-4 lg:mx-0">
            <CompartirTarjeta habitId={habit.id} nombre={habit.name} />
          </div>

          <div className="mx-4 lg:mx-0">
            <GestionDeReto habitId={habit.id} nombre={habit.name} />
          </div>
        </div>

        <section className="mx-4 flex flex-col gap-3 rounded-[22px] bg-card px-3.5 py-4 lg:mx-0 lg:px-5 lg:py-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-label">
              {monthName(today)}
            </h2>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11.5px] tracking-[-0.01em] text-label-2">
                <span className="size-2.5 rounded-[3px] bg-azul" />
                Limpio
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] tracking-[-0.01em] text-label-2">
                <span className="size-2.5 rounded-[3px] bg-ambar" />
                Recaída
              </span>
            </div>
          </div>

          <MonthHeatmap
            habitId={habit.id}
            days={grid}
            today={today}
            initial={Object.fromEntries(byDate)}
          />

          <p className="text-[12px] leading-[1.35] text-label-2">
            ¿Se te olvidó marcar un día? Tócalo y corrígelo.
          </p>
        </section>
      </div>
    </div>
  );
}
