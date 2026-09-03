import { redirect } from "next/navigation";
import { HabitIcon } from "@/components/habit-icon";
import { JournalEditor } from "@/components/journal-editor";
import { longDate, shiftISO, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { usuarioActual } from "@/lib/supabase/sesion";
import { MOOD_BY_KEY, type Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bitácora · Antídoto" };

export default async function BitacoraPage() {
  const supabase = await createClient();

  const user = await usuarioActual();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<Profile, "timezone">>();

  const today = todayIn(profile?.timezone ?? "UTC");
  const since = shiftISO(today, -120);

  const [{ data: entries }, { data: logs }, { data: habits }] =
    await Promise.all([
      supabase
        .from("journal_entries")
        .select("entry_date, mood, note")
        .gte("entry_date", since)
        .order("entry_date", { ascending: false }),
      supabase
        .from("habit_logs")
        .select("habit_id, log_date, status")
        .gte("log_date", since),
      // `status` viene para poder contar los que faltan por marcar hoy. Los
      // archivados siguen viniendo a propósito: son el diccionario con el que
      // se pintan el nombre y el icono de entradas viejas, y sin ellos una
      // entrada de hace dos meses perdería de qué hábito era.
      supabase.from("habits").select("id, name, icon, color, status"),
    ]);

  const habitById = new Map(
    (habits ?? []).map((habit) => [habit.id as string, habit]),
  );

  // Qué hábitos se cumplieron cada día, para colgarlos de su entrada. Se
  // guarda el hábito entero y no solo su icono: `icon` ahora es una clave
  // ("azucar", "redes") y pintarla tal cual dejaba la palabra suelta ahí.
  const cleanByDate = new Map<
    string,
    { id: string; name: string; icon: string }[]
  >();
  for (const log of logs ?? []) {
    if (log.status !== "success") continue;
    const habit = habitById.get(log.habit_id as string);
    if (!habit) continue;
    const day = log.log_date as string;
    cleanByDate.set(day, [
      ...(cleanByDate.get(day) ?? []),
      {
        id: habit.id as string,
        name: habit.name as string,
        icon: habit.icon as string,
      },
    ]);
  }

  const todayEntry = (entries ?? []).find(
    (entry) => entry.entry_date === today,
  );

  /**
   * Cuántos hábitos siguen sin marcar hoy.
   *
   * Se cuenta aquí y no solo en Hoy porque el editor de esta pantalla escribe
   * la misma entrada del mismo día. Si el candado viviera únicamente allá, para
   * saltárselo bastaría con venir a Bitácora, y entonces no sería una regla
   * sino un adorno de una pantalla.
   *
   * Solo los activos, igual que `get_daily_overview`: un hábito archivado no se
   * marca, así que contarlo dejaría el día imposible de cerrar para siempre.
   */
  const marcadosHoy = new Set(
    (logs ?? [])
      .filter((log) => log.log_date === today)
      .map((log) => log.habit_id as string),
  );
  const pendientes = (habits ?? []).filter(
    (habit) => habit.status === "active" && !marcadosHoy.has(habit.id as string),
  ).length;

  // La de hoy también va en el historial. Antes se excluía porque ya estaba en
  // el editor de arriba, pero eso hacía que al guardar no apareciera en ningún
  // lado y pareciera que no se había guardado.
  const historial = entries ?? [];

  return (
    <div className="flex flex-col gap-4 pt-11 lg:pt-0">
      <header className="entrar flex flex-col gap-0.5 px-5 lg:px-0">
        <span className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-label-3">
          {longDate(today)}
        </span>
        <h1 className="font-display text-[26px] font-semibold leading-none tracking-[-0.01em] text-label lg:text-[30px]">
          Bitácora
        </h1>
      </header>

      {/* En escritorio el editor se queda a la vista mientras se lee el
          historial al lado; apilado ocupaba media pantalla y empujaba todo. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-6">
        <section
          className="entrar mx-4 lg:sticky lg:top-7 lg:mx-0"
          style={{ animationDelay: "0.06s" }}
        >
          <JournalEditor
            date={today}
            initialMood={todayEntry?.mood ?? null}
            initialNote={todayEntry?.note ?? null}
            pendientes={pendientes}
          />
        </section>

        <section
          className="entrar flex flex-col gap-2.5"
          style={{ animationDelay: "0.12s" }}
        >
          <h2 className="px-6 text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3 lg:px-0">
            Historial
          </h2>

          {historial.length === 0 ? (
            <p className="mx-4 lg:mx-0 text-pretty rounded-2xl bg-card px-4 py-5 text-center text-[15px] leading-[1.4] text-label-2">
              Todavía no has escrito nada. Lo que guardes arriba aparece aquí.
            </p>
          ) : (
            <ol className="mx-4 lg:mx-0 flex flex-col gap-2">
              {historial.map((entry) => {
                const date = entry.entry_date as string;
                const cumplidos = cleanByDate.get(date) ?? [];

                return (
                  <li
                    key={date}
                    className="flex gap-3 rounded-2xl bg-card px-4 py-3.5"
                  >
                    <span
                      aria-label={
                        MOOD_BY_KEY.get(entry.mood as string)?.label ??
                        "Sin ánimo"
                      }
                      className="shrink-0 text-[26px] leading-none"
                    >
                      {MOOD_BY_KEY.get(entry.mood as string)?.emoji ?? "•"}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        {/* La fecha va siempre. Antes la de hoy decía solo
                            "Hoy", y quien acababa de escribir su primera
                            entrada veía una lista sin una sola fecha. */}
                        <span className="flex items-baseline gap-2">
                          {date === today && (
                            <span className="rounded-md bg-azul px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-azul-tinta">
                              Hoy
                            </span>
                          )}
                          <span className="text-[15px] font-semibold tracking-[-0.01em] text-label">
                            {longDate(date)}
                          </span>
                        </span>
                        {cumplidos.length > 0 && (
                          <span
                            title={cumplidos.map((h) => h.name).join(", ")}
                            aria-label={`${cumplidos.length} ${cumplidos.length === 1 ? "hábito cumplido" : "hábitos cumplidos"}: ${cumplidos.map((h) => h.name).join(", ")}`}
                            className="flex shrink-0 items-center gap-1 text-menta"
                          >
                            {cumplidos.map((habit) => (
                              <HabitIcon
                                key={habit.id}
                                clave={habit.icon}
                                size={16}
                              />
                            ))}
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
    </div>
  );
}
