import { redirect } from "next/navigation";
import { JournalEditor } from "@/components/journal-editor";
import { longDate, shiftISO, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { MOOD_BY_KEY, type Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bitácora · Antídoto" };

export default async function BitacoraPage() {
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
  const since = shiftISO(today, -120);

  const [{ data: entries }, { data: logs }, { data: habits }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("entry_date, mood, note")
      .gte("entry_date", since)
      .order("entry_date", { ascending: false }),
    supabase
      .from("habit_logs")
      .select("habit_id, log_date, status")
      .gte("log_date", since),
    supabase.from("habits").select("id, name, icon"),
  ]);

  const habitById = new Map(
    (habits ?? []).map((habit) => [habit.id as string, habit]),
  );

  // Qué hábitos se cumplieron cada día, para colgarlos de su entrada.
  const cleanByDate = new Map<string, string[]>();
  for (const log of logs ?? []) {
    if (log.status !== "success") continue;
    const habit = habitById.get(log.habit_id as string);
    if (!habit) continue;
    const day = log.log_date as string;
    cleanByDate.set(day, [...(cleanByDate.get(day) ?? []), habit.icon as string]);
  }

  const todayEntry = (entries ?? []).find((entry) => entry.entry_date === today);
  const past = (entries ?? []).filter((entry) => entry.entry_date !== today);

  return (
    <div className="flex flex-col gap-5 pt-11">
      <header className="flex flex-col gap-0.5 px-5">
        <h1 className="text-[34px] font-bold leading-[1.08] tracking-[-0.026em] text-label">
          Bitácora
        </h1>
        <p className="text-[15px] tracking-[-0.01em] text-label-2">
          {longDate(today)}
        </p>
      </header>

      <section className="mx-4">
        <JournalEditor
          date={today}
          initialMood={todayEntry?.mood ?? null}
          initialNote={todayEntry?.note ?? null}
        />
      </section>

      <section className="flex flex-col gap-[7px]">
        <h2 className="px-8 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
          Días anteriores
        </h2>

        {past.length === 0 ? (
          <p className="mx-4 text-pretty rounded-2xl bg-card px-4 py-5 text-center text-[15px] leading-[1.4] text-label-2">
            Todavía no hay entradas anteriores. La de hoy aparecerá aquí mañana.
          </p>
        ) : (
          <ol className="mx-4 flex flex-col gap-2">
            {past.map((entry) => {
              const date = entry.entry_date as string;
              const icons = cleanByDate.get(date) ?? [];

              return (
                <li
                  key={date}
                  className="flex gap-3 rounded-2xl bg-card px-4 py-3.5"
                >
                  <span
                    aria-label={MOOD_BY_KEY.get(entry.mood as string)?.label ?? "Sin ánimo"}
                    className="shrink-0 text-[26px] leading-none"
                  >
                    {MOOD_BY_KEY.get(entry.mood as string)?.emoji ?? "•"}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[15px] font-semibold tracking-[-0.01em] text-label">
                        {longDate(date)}
                      </span>
                      {icons.length > 0 && (
                        <span
                          aria-label={`${icons.length} ${icons.length === 1 ? "hábito cumplido" : "hábitos cumplidos"}`}
                          className="shrink-0 text-[13px]"
                        >
                          {icons.join(" ")}
                        </span>
                      )}
                    </div>
                    {entry.note && (
                      <p className="whitespace-pre-line text-pretty text-[15px] leading-[1.4] tracking-[-0.01em] text-label-2">
                        {entry.note}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
