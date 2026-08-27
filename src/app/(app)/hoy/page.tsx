import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Companion } from "@/components/companion";
import { HabitCard } from "@/components/habit-card";
import { Isotipo } from "@/components/logo";
import { MoodPicker } from "@/components/mood-picker";
import { longDate, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { HABIT_SKIN, type DailyOverviewRow, type Profile, type Quote } from "@/lib/types";

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
  const principal = habits[0];
  const skin = principal ? HABIT_SKIN[principal.color] : HABIT_SKIN.blue;
  const marcadosHoy = habits.filter((h) => h.today_status === "success").length;

  return (
    <div className="flex flex-col gap-4 pt-3">
      <header className="entrar flex items-center justify-between px-5">
        <Isotipo size={30} />
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-label-3">
            {longDate(today)}
          </span>
          <h1 className="font-display text-[26px] font-semibold leading-none tracking-[-0.01em] text-label">
            {firstName ? `Hola, ${firstName}` : "Hoy"}
          </h1>
        </div>
      </header>

      {principal && (
        <section
          className="entrar relative mx-4 overflow-hidden rounded-[26px] px-5 pb-5 pt-6"
          style={{ background: skin.fondo, animationDelay: "0.06s" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span
                className="text-[11.5px] font-bold uppercase tracking-[0.1em] opacity-65"
                style={{ color: skin.tinta }}
              >
                Reto activo
              </span>
              <h2
                className="font-display text-[27px] font-semibold leading-[1.1] tracking-[-0.01em]"
                style={{ color: skin.tinta }}
              >
                {principal.name}
              </h2>
            </div>

            <div className="flex flex-col items-end">
              <span
                className="tnum font-display text-[46px] font-bold leading-none tracking-[-0.03em]"
                style={{ color: skin.tinta }}
              >
                {principal.clean_days}
              </span>
              <span
                className="tnum text-[13px] font-semibold opacity-70"
                style={{ color: skin.tinta }}
              >
                de {principal.target_days} días
              </span>
            </div>
          </div>

          <div
            className="mt-4 h-2.5 overflow-hidden rounded-full"
            style={{ background: "rgba(0,0,0,0.16)" }}
            role="progressbar"
            aria-valuenow={principal.clean_days}
            aria-valuemin={0}
            aria-valuemax={principal.target_days}
            aria-label={`Progreso de ${principal.name}`}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (principal.clean_days / principal.target_days) * 100)}%`,
                background: skin.tinta,
                opacity: 0.9,
              }}
            />
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <p
              className="max-w-[62%] text-pretty text-[14px] leading-[1.4] opacity-80"
              style={{ color: skin.tinta }}
            >
              {principal.current_streak === 0
                ? "Hoy puede ser el día uno."
                : `Llevas ${principal.current_streak} ${principal.current_streak === 1 ? "día seguido" : "días seguidos"}.`}
            </p>
            <Companion
              who={profile.companion ?? "brote"}
              size={92}
              mood={marcadosHoy > 0 ? "contento" : "normal"}
              className="flota -mb-5 shrink-0"
              sombra={false}
            />
          </div>
        </section>
      )}

      {frase && (
        <section
          className="entrar mx-4 rounded-[22px] bg-card px-5 py-4"
          style={{ animationDelay: "0.12s" }}
        >
          <p className="text-pretty font-display text-[16px] font-medium leading-[1.4] text-label">
            {frase.text}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="px-6 text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3">
          Tus hábitos
        </h2>

        <div className="flex flex-col gap-2.5 px-4">
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
            {habits.length === 0 ? "Crear tu primer hábito" : "Agregar hábito"}
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="px-6 text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3">
          ¿Cómo te sentiste hoy?
        </h2>
        <div className="px-4">
          <MoodPicker today={today} selected={entry.data?.mood ?? null} />
        </div>
      </section>
    </div>
  );
}
