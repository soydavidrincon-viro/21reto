import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HabitActions } from "@/components/habit-actions";
import { monthGrid, monthName, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<Profile, "timezone">>();

  const today = todayIn(profile?.timezone ?? "UTC");

  const [{ data: habit }, { data: statsRows }, { data: logs }] = await Promise.all([
    supabase.from("habits").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("get_habit_stats", { p_habit_id: id, p_today: today }),
    supabase.from("habit_logs").select("log_date, status").eq("habit_id", id),
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

  const grid = monthGrid(today);
  const todayStatus = byDate.get(today) ?? null;

  return (
    <div className="flex flex-col gap-3.5">
      <header className="sticky top-0 z-10 -mx-px flex h-11 items-center justify-between border-b border-separator bg-bar px-3 backdrop-blur-xl">
        <Link
          href="/hoy"
          className="inline-flex items-center gap-0.5 text-[17px] tracking-[-0.02em] text-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
        >
          <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true">
            <path
              d="M9.5 2.5 2.5 10l7 7.5"
              fill="none"
              className="stroke-blue"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Hoy
        </Link>
        <h1 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-label">
          {habit.name}
        </h1>
        <span className="w-12" />
      </header>

      <section className="mx-4 flex flex-col items-center gap-2 rounded-2xl bg-card px-4 py-6">
        <span aria-hidden="true" className="text-[34px]">
          {habit.icon}
        </span>
        <p className="flex items-baseline gap-2">
          <span className="tnum font-num text-[46px] font-bold leading-none tracking-[-0.04em] text-label">
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

      <section className="mx-4 flex rounded-2xl bg-card px-1.5 py-3.5">
        {[
          [stats.clean_days, "Días limpios"],
          [stats.best_streak, "Mejor racha"],
          [`${stats.completion_rate}%`, "Cumplimiento"],
          [stats.relapses, stats.relapses === 1 ? "Recaída" : "Recaídas"],
        ].map(([value, label]) => (
          <div key={String(label)} className="flex w-full flex-col items-center gap-0.5">
            <b className="tnum font-num text-[22px] font-bold tracking-[-0.03em] text-label">
              {value}
            </b>
            <small className="text-center text-[11.5px] tracking-[-0.01em] text-label-2">
              {label}
            </small>
          </div>
        ))}
      </section>

      <section className="mx-4 flex flex-col gap-3 rounded-2xl bg-card px-3.5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-label">
            {monthName(today)}
          </h2>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11.5px] tracking-[-0.01em] text-label-2">
              <span className="size-2.5 rounded-[3px] bg-blue" />
              Limpio
            </span>
            <span className="flex items-center gap-1.5 text-[11.5px] tracking-[-0.01em] text-label-2">
              <span className="size-2.5 rounded-[3px] bg-yellow" />
              Recaída
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5" aria-hidden="true">
          {["L", "M", "M", "J", "V", "S", "D"].map((initial, i) => (
            <span
              key={i}
              className="text-center text-[10.5px] font-semibold text-label-2"
            >
              {initial}
            </span>
          ))}
        </div>

        <ul className="grid grid-cols-7 gap-1.5">
          {grid.map((date, i) => {
            if (!date) return <li key={`gap-${i}`} aria-hidden="true" />;

            const status = byDate.get(date);
            const isToday = date === today;
            const isFuture = date > today;

            const tone = status === "success"
              ? "bg-blue text-white"
              : status === "relapse"
                ? "bg-yellow text-[#4A3A00]"
                : isToday
                  ? "bg-card text-blue ring-2 ring-blue ring-inset"
                  : "bg-fill text-label-3";

            return (
              <li
                key={date}
                aria-label={`${date}: ${
                  status === "success"
                    ? "limpio"
                    : status === "relapse"
                      ? "recaída"
                      : isFuture
                        ? "por venir"
                        : "sin registro"
                }`}
                className={`tnum flex h-[30px] items-center justify-center rounded-lg text-[11px] font-semibold ${tone}`}
              >
                {Number(date.slice(-2))}
              </li>
            );
          })}
        </ul>
      </section>

      <HabitActions habitId={habit.id} today={today} todayStatus={todayStatus} />
    </div>
  );
}
