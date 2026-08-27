import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HabitCard } from "@/components/habit-card";
import { RetoCarrusel } from "@/components/reto-carrusel";
import { Isotipo } from "@/components/logo";
import { MoodPicker } from "@/components/mood-picker";
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
      .select("mood, note")
      .eq("user_id", user.id)
      .eq("entry_date", today)
      .maybeSingle(),
  ]);

  const habits = (overview.data ?? []) as DailyOverviewRow[];
  const frase = ((quote.data ?? []) as Quote[])[0];
  const firstName = profile.display_name?.split(" ")[0] ?? "";
  const marcadosHoy = habits.filter((h) => h.today_status === "success").length;
  const totalLimpios = habits.reduce((suma, h) => suma + h.clean_days, 0);
  const mejorRacha = habits.reduce((max, h) => Math.max(max, h.best_streak), 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="entrar flex items-center justify-between px-5 lg:px-0">
        <Isotipo size={30} className="lg:hidden" />
        <div className="flex flex-col gap-0.5 lg:gap-1">
          <span className="hidden text-[12.5px] font-semibold uppercase tracking-[0.06em] text-label-3 lg:block">
            {longDate(today)}
          </span>
          <h1 className="hidden font-display text-[30px] font-semibold leading-none tracking-[-0.01em] text-label lg:block">
            {firstName ? `Hola, ${firstName}` : "Hoy"}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-0.5 lg:hidden">
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-label-3">
            {longDate(today)}
          </span>
          <h1 className="font-display text-[26px] font-semibold leading-none tracking-[-0.01em] text-label">
            {firstName ? `Hola, ${firstName}` : "Hoy"}
          </h1>
        </div>
        <span className="hidden text-[14px] font-medium text-label-2 lg:block">
          {marcadosHoy} de {habits.length} marcados hoy
        </span>
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.45fr_1fr] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <RetoCarrusel
            habits={habits}
            companion={profile.companion ?? "brote"}
            marcadosHoy={marcadosHoy}
          />

          <section className="flex flex-col gap-2.5">
            <h2 className="px-6 text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3 lg:px-0">
              Tus hábitos
            </h2>

            <div className="flex flex-col gap-2.5 px-4 lg:px-0">
              {habits.map((habit, i) => (
                <HabitCard
                  key={habit.habit_id}
                  habit={habit}
                  today={today}
                  delay={0.18 + i * 0.06}
                />
              ))}

              <Link
                href="/habito/nuevo"
                className="entrar pulsable flex items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-separator py-4 text-[15px] font-semibold text-label-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                style={{ animationDelay: `${0.18 + habits.length * 0.06}s` }}
              >
                <Plus size={18} weight="bold" aria-hidden="true" />
                {habits.length === 0
                  ? "Crear tu primer hábito"
                  : "Agregar hábito"}
              </Link>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          {/* El resumen del día. Antes solo existía en escritorio, así que en
              teléfono —donde se usa la app— no había ni un número que dijera
              cómo va el día en conjunto. Ahora va en las dos. */}
          {habits.length > 0 && (
            <section
              className="entrar mx-4 flex flex-col gap-3.5 rounded-[22px] bg-card p-4 lg:mx-0 lg:p-5"
              style={{ animationDelay: "0.09s" }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3">
                    Hoy
                  </span>
                  <span className="tnum text-[13px] font-semibold text-label-2">
                    {marcadosHoy} de {habits.length}{" "}
                    {habits.length === 1 ? "marcado" : "marcados"}
                  </span>
                </div>
                <div
                  className="flex gap-1"
                  role="progressbar"
                  aria-valuenow={marcadosHoy}
                  aria-valuemin={0}
                  aria-valuemax={habits.length}
                  aria-label="Hábitos marcados hoy"
                >
                  {habits.map((habit) => (
                    <span
                      key={habit.habit_id}
                      className={`h-2.5 flex-1 rounded-full ${
                        habit.today_status === "success"
                          ? "bg-menta"
                          : habit.today_status === "relapse"
                            ? "bg-ambar"
                            : "bg-fill"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-separator pt-3.5">
                {(
                  [
                    [totalLimpios, "Días limpios", "text-label"],
                    [mejorRacha, "Mejor racha", "text-naranja"],
                    [
                      habits.length,
                      habits.length === 1 ? "Hábito" : "Hábitos",
                      "text-label",
                    ],
                  ] as const
                ).map(([valor, etiqueta, tono]) => (
                  <div
                    key={etiqueta}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <b
                      className={`tnum font-display text-[26px] font-bold leading-none lg:text-[28px] ${tono}`}
                    >
                      {valor}
                    </b>
                    <small className="text-center text-[12px] text-label-2">
                      {etiqueta}
                    </small>
                  </div>
                ))}
              </div>
            </section>
          )}

          {frase && (
            <section
              className="entrar mx-4 rounded-[22px] bg-card px-5 py-4 lg:mx-0 lg:px-6 lg:py-6"
              style={{ animationDelay: "0.12s" }}
            >
              <p className="text-pretty font-display text-[16px] font-medium leading-[1.4] text-label lg:text-[19px] lg:leading-[1.45]">
                {frase.text}
              </p>
            </section>
          )}

          <section className="flex flex-col gap-2.5">
            <h2 className="px-6 text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3 lg:px-0">
              ¿Cómo te sentiste hoy?
            </h2>
            <div className="px-4 lg:px-0">
              <MoodPicker
                today={today}
                selected={entry.data?.mood ?? null}
                nota={entry.data?.note ?? null}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
