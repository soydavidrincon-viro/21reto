import { Plant } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { MoodLine } from "@/components/mood-line";
import { WeeklyBars } from "@/components/weekly-bars";
import { lastSevenDays, shiftISO, todayIn, weekdayInitial } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Progreso · Antídoto" };

const WEEKS = 6;

export default async function ProgresoPage() {
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

  // La semana empieza el lunes. getDay() cuenta desde domingo, de ahí el ajuste.
  const offsetToMonday = (new Date(`${today}T00:00:00`).getDay() + 6) % 7;
  const thisMonday = shiftISO(today, -offsetToMonday);
  const firstMonday = shiftISO(thisMonday, -(WEEKS - 1) * 7);

  const [{ data: logs }, { data: entries }, { count: activeHabits }] =
    await Promise.all([
      supabase
        .from("habit_logs")
        .select("log_date, status")
        .gte("log_date", firstMonday),
      supabase
        .from("journal_entries")
        .select("entry_date, mood")
        .gte("entry_date", shiftISO(today, -6)),
      supabase
        .from("habits")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

  const { count: totalClean } = await supabase
    .from("habit_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", "success");

  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = shiftISO(firstMonday, i * 7);
    const end = shiftISO(start, 6);

    const inWeek = (logs ?? []).filter(
      (log) => (log.log_date as string) >= start && (log.log_date as string) <= end,
    );
    const success = inWeek.filter((log) => log.status === "success").length;
    const counted = inWeek.filter((log) => log.status !== "skipped").length;

    return {
      label: i === WEEKS - 1 ? "Esta" : `S${i + 1}`,
      range: `${start.slice(8)}/${start.slice(5, 7)} – ${end.slice(8)}/${end.slice(5, 7)}`,
      value: counted === 0 ? null : Math.round((success / counted) * 100),
    };
  });

  const measured = weeks.filter((week) => week.value !== null);
  const average =
    measured.length === 0
      ? null
      : Math.round(
          measured.reduce((sum, week) => sum + week.value!, 0) / measured.length,
        );

  const moodByDate = new Map(
    (entries ?? []).map((entry) => [entry.entry_date as string, entry.mood as string]),
  );

  const points = lastSevenDays(today).map((date) => ({
    date,
    label: weekdayInitial(date),
    mood: moodByDate.get(date) ?? null,
  }));

  return (
    <div className="flex flex-col gap-4 pt-11 lg:pt-0">
      <header className="px-5 lg:px-0">
        <h1 className="font-display text-[30px] font-semibold leading-[1.08] tracking-[-0.01em] text-label lg:text-[34px]">
          Progreso
        </h1>
      </header>

      <section className="mx-4 lg:mx-0 flex items-center gap-3.5 rounded-2xl bg-card px-4 py-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-menta text-menta-tinta">
          <Plant size={24} weight="fill" aria-hidden="true" />
        </span>
        <div className="flex flex-1 flex-col gap-px">
          <span className="text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
            Total acumulado
          </span>
          <p className="flex items-baseline gap-2">
            <span className="tnum font-display text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-label">
              {totalClean ?? 0}
            </span>
            <span className="text-[15px] font-medium tracking-[-0.01em] text-label-2">
              {totalClean === 1 ? "día limpio" : "días limpios"}
            </span>
          </p>
        </div>
        <span className="tnum shrink-0 rounded-lg bg-fill px-2.5 py-1.5 text-[13px] font-semibold text-label-2">
          {activeHabits ?? 0} {activeHabits === 1 ? "hábito" : "hábitos"}
        </span>
      </section>

      <section className="flex flex-col gap-[7px]">
        <h2 className="px-8 text-[13px] lg:px-0 font-semibold uppercase tracking-[0.02em] text-label-2">
          Cumplimiento por semana
        </h2>
        <div className="mx-4 lg:mx-0 flex flex-col gap-3.5 rounded-2xl bg-card px-3.5 py-4">
          <p className="flex items-baseline gap-1.5">
            <span className="tnum font-display text-[26px] font-bold tracking-[-0.03em] text-label">
              {average === null ? "—" : `${average}%`}
            </span>
            <span className="text-[14px] tracking-[-0.01em] text-label-2">
              {average === null
                ? "todavía sin datos suficientes"
                : `promedio de ${measured.length} ${measured.length === 1 ? "semana" : "semanas"}`}
            </span>
          </p>
          <WeeklyBars weeks={weeks} />
        </div>
      </section>

      <section className="flex flex-col gap-[7px]">
        <h2 className="px-8 text-[13px] lg:px-0 font-semibold uppercase tracking-[0.02em] text-label-2">
          Tu ánimo esta semana
        </h2>
        <div className="mx-4 lg:mx-0 rounded-2xl bg-card px-3.5 py-4">
          <MoodLine points={points} />
        </div>
      </section>
    </div>
  );
}
