import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HabitRow } from "@/components/habit-row";
import { MoodPicker } from "@/components/mood-picker";
import { ProgressRings } from "@/components/progress-rings";
import { longDate, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { DailyOverviewRow, Profile, Quote } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HoyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile?.onboarded_at) redirect("/bienvenida");

  // El día se resuelve con la zona horaria del perfil, no con la del servidor.
  const today = todayIn(profile.timezone);

  const [overview, quote, entry] = await Promise.all([
    supabase.rpc("get_daily_overview", { p_date: today }),
    supabase.rpc("get_daily_quote", { p_date: today }),
    supabase
      .from("journal_entries")
      .select("mood")
      .eq("user_id", user.id)
      .eq("entry_date", today)
      .maybeSingle(),
  ]);

  const habits = (overview.data ?? []) as DailyOverviewRow[];
  const frase = ((quote.data ?? []) as Quote[])[0];
  const firstName = profile.display_name?.split(" ")[0] ?? "";

  return (
    <div className="flex flex-col gap-3.5 pt-11">
      <header className="flex flex-col gap-0.5 px-5">
        <span className="text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
          {longDate(today)}
        </span>
        <h1 className="text-[34px] font-bold leading-[1.08] tracking-[-0.026em] text-label">
          {firstName ? `Hola, ${firstName}` : "Hoy"}
        </h1>
      </header>

      {habits.length > 0 && (
        <section className="mx-4 flex items-center gap-4 rounded-2xl bg-card p-4">
          <ProgressRings
            rings={habits.map((h) => ({
              color: h.color,
              value: h.clean_days,
              goal: h.target_days,
              label: h.name,
            }))}
          />
          <ul className="flex flex-1 flex-col gap-3">
            {habits.slice(0, 3).map((habit) => (
              <li key={habit.habit_id} className="flex flex-col gap-px">
                <span
                  className="text-[11.5px] font-bold uppercase tracking-[0.03em]"
                  style={{ color: `var(--c-${habit.color})` }}
                >
                  {habit.name}
                </span>
                <span className="tnum font-num text-[20px] font-bold tracking-[-0.02em] text-label">
                  {habit.clean_days}
                  <span className="text-[14px] font-semibold text-label-2">
                    /{habit.target_days} días
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {frase && (
        <section className="mx-4 flex items-start gap-3 rounded-2xl bg-card px-4 py-3.5">
          <span aria-hidden="true" className="shrink-0 text-[20px] leading-[1.25]">
            💬
          </span>
          <p className="text-pretty text-[15px] leading-[1.4] tracking-[-0.01em] text-label">
            {frase.text}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-[7px]">
        <h2 className="px-8 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
          Tus hábitos
        </h2>
        <div className="mx-4 overflow-hidden rounded-2xl bg-card">
          {habits.map((habit, i) => (
            <HabitRow
              key={habit.habit_id}
              habit={habit}
              today={today}
              last={i === habits.length - 1}
            />
          ))}

          {habits.length > 0 && <div className="ml-[58px] h-px bg-separator" />}

          <Link
            href="/habito/nuevo"
            className="flex items-center gap-3 px-3.5 py-2.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-fill">
              <Plus size={17} weight="bold" className="text-blue" aria-hidden="true" />
            </span>
            <span className="text-[17px] font-medium tracking-[-0.02em] text-blue">
              {habits.length === 0 ? "Crear tu primer hábito" : "Agregar hábito"}
            </span>
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-[7px]">
        <h2 className="px-8 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
          ¿Cómo te sentiste hoy?
        </h2>
        <div className="mx-4">
          <MoodPicker today={today} selected={entry.data?.mood ?? null} />
        </div>
      </section>
    </div>
  );
}
