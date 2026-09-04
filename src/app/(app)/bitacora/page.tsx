import { redirect } from "next/navigation";
import { JournalEditor } from "@/components/journal-editor";
import {
  DiaDeBitacora,
  type DiaDeBitacora as Dia,
  type HabitoDelDia,
  type ImpulsoDeBitacora,
} from "@/components/dia-de-bitacora";
import { longDate, shiftISO, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { usuarioActual } from "@/lib/supabase/sesion";
import type { Profile } from "@/lib/types";

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

  const [{ data: entries }, { data: logs }, { data: habits }, { data: cravings }] =
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
      supabase.from("habits").select("id, name, icon, kind"),
      supabase
        .from("cravings")
        .select("habit_id, local_date, local_hour, trigger_key, resisted, note")
        .gte("local_date", since),
    ]);

  const habitById = new Map(
    (habits ?? []).map((habit) => [habit.id as string, habit]),
  );

  /**
   * Un día del historial se arma de tres sitios: la entrada escrita, lo que se
   * marcó y los impulsos que hubo.
   *
   * Antes la lista salía solo de `journal_entries`, así que un día en el que
   * marcaste tus hábitos y aguantaste dos impulsos pero no escribiste nada no
   * existía. El historial se veía vacío justo los días en que más se había
   * hecho. Ahora aparece cualquier día con algo dentro, se haya escrito o no.
   */
  const porDia = new Map<string, Dia>();

  const dia = (fecha: string): Dia => {
    let d = porDia.get(fecha);
    if (!d) {
      d = {
        fecha,
        mood: null,
        nota: null,
        cumplidos: [],
        recaidas: [],
        impulsos: [],
      };
      porDia.set(fecha, d);
    }
    return d;
  };

  for (const entry of entries ?? []) {
    const d = dia(entry.entry_date as string);
    d.mood = (entry.mood as string | null) ?? null;
    d.nota = (entry.note as string | null) ?? null;
  }

  for (const log of logs ?? []) {
    // El hábito puede haberse borrado; sus registros se van con él, pero un
    // desfase entre consultas no debería tumbar la página.
    const habit = habitById.get(log.habit_id as string);
    if (!habit) continue;

    const ficha: HabitoDelDia = {
      id: habit.id as string,
      name: habit.name as string,
      icon: habit.icon as string,
      kind: habit.kind as "quit" | "build",
    };
    const d = dia(log.log_date as string);
    if (log.status === "success") d.cumplidos.push(ficha);
    else if (log.status === "relapse") d.recaidas.push(ficha);
  }

  for (const craving of cravings ?? []) {
    const habit = craving.habit_id
      ? habitById.get(craving.habit_id as string)
      : undefined;

    const impulso: ImpulsoDeBitacora = {
      hora: craving.local_hour as number,
      trigger: (craving.trigger_key as string | null) ?? null,
      resistido: craving.resisted as boolean,
      nota: (craving.note as string | null) ?? null,
      habito: (habit?.name as string | undefined) ?? null,
    };
    dia(craving.local_date as string).impulsos.push(impulso);
  }

  const historial = [...porDia.values()].sort((a, b) =>
    a.fecha < b.fecha ? 1 : -1,
  );

  const entradaDeHoy = porDia.get(today);

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
            initialMood={entradaDeHoy?.mood ?? null}
            initialNote={entradaDeHoy?.nota ?? null}
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
            <p className="mx-4 text-pretty rounded-2xl bg-card px-4 py-5 text-center text-[15px] leading-[1.4] text-label-2 lg:mx-0">
              Todavía no hay nada. Marca un día o escribe arriba y aparece aquí.
            </p>
          ) : (
            <ol className="mx-4 flex flex-col gap-2 lg:mx-0">
              {historial.map((d) => (
                <DiaDeBitacora
                  key={d.fecha}
                  dia={d}
                  esHoy={d.fecha === today}
                />
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
