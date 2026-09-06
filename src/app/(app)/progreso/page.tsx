import { redirect } from "next/navigation";
import { CravingGrid } from "@/components/craving-grid";
import { MoodLine } from "@/components/mood-line";
import { RetosEnNumeros } from "@/components/retos-en-numeros";
import { WeeklyBars } from "@/components/weekly-bars";
import {
  lastSevenDays,
  rangoCorto,
  shiftISO,
  todayIn,
  weekdayInitial,
} from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { usuarioActual } from "@/lib/supabase/sesion";
import {
  conDiasPorDefecto,
  type CravingGridCell,
  type CravingSummary,
  type DailyOverviewRow,
  type Profile,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Progreso · Antídoto" };

const WEEKS = 6;

type SemanaRow = {
  semana: number;
  inicio: string;
  fin: string;
  esperados: number;
  cumplidos: number;
};

export default async function ProgresoPage() {
  const supabase = await createClient();

  const user = await usuarioActual();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<Profile, "timezone">>();

  const today = todayIn(profile?.timezone ?? "UTC");

  // Los impulsos de los últimos 90 días. Más atrás la vida de alguien ya cambió
  // y el patrón de hace medio año no describe el de ahora.
  const desdeImpulsos = shiftISO(today, -90);

  /*
   * Todo en una tanda. Antes eran cuatro rondas de ida y vuelta —hábitos,
   * luego el total, luego los impulsos— y ninguna dependía de la anterior:
   * todas necesitan solo `today`. Con Supabase frío, cada ronda de más se
   * notaba al tocar la pestaña.
   *
   * El cumplimiento por semana lo calcula SQL con las mismas reglas que la
   * racha; aquí solo se pinta.
   */
  const [semanas, { data: entries }, overview, { count: totalClean }, rejilla, resumenImpulsos] =
    await Promise.all([
      supabase.rpc("cumplimiento_semanal", { p_today: today, p_semanas: WEEKS }),
      supabase
        .from("journal_entries")
        .select("entry_date, mood")
        .gte("entry_date", shiftISO(today, -6)),
      // Cada reto con su racha, para los bloques de arriba. Es la misma
      // consulta que Hoy, así que los dos números no pueden discrepar.
      supabase.rpc("get_daily_overview", { p_date: today }),
      supabase
        .from("habit_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "success")
        .lte("log_date", today),
      supabase.rpc("get_craving_grid", { p_since: desdeImpulsos }),
      supabase.rpc("get_craving_summary", { p_since: desdeImpulsos }),
    ]);

  const habits = ((overview.data ?? []) as DailyOverviewRow[]).map(
    conDiasPorDefecto,
  );
  const activeHabits = habits.length;

  const celdas = ((rejilla.data ?? []) as CravingGridCell[]).map((c) => ({
    ...c,
    total: Number(c.total),
    resisted: Number(c.resisted),
  }));
  const resumen = ((resumenImpulsos.data ?? []) as CravingSummary[])[0] ?? null;

  // Debajo de cada barra va el rango de fechas, no "S1, S2": nadie sabía si
  // eso era la primera semana del reto, del mes o de la gráfica.
  const weeks = ((semanas.data ?? []) as SemanaRow[]).map((s) => ({
    label: s.semana === WEEKS - 1 ? "Esta semana" : rangoCorto(s.inicio, s.fin),
    range: rangoCorto(s.inicio, s.fin),
    // Sin días esperados no hay nota que poner: es una semana anterior al
    // reto, no una semana suspendida.
    value:
      s.esperados === 0 ? null : Math.round((s.cumplidos / s.esperados) * 100),
  }));

  const measured = weeks.filter((week) => week.value !== null);
  const average =
    measured.length === 0
      ? null
      : Math.round(
          measured.reduce((sum, week) => sum + week.value!, 0) /
            measured.length,
        );

  const moodByDate = new Map(
    (entries ?? []).map((entry) => [
      entry.entry_date as string,
      entry.mood as string,
    ]),
  );

  const points = lastSevenDays(today).map((date) => ({
    date,
    label: weekdayInitial(date),
    mood: moodByDate.get(date) ?? null,
  }));

  return (
    <div className="flex flex-col gap-4 pt-11 lg:pt-0">
      <header className="entrar flex flex-col gap-0.5 px-5 lg:px-0">
        <span className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-label-3">
          Últimas {WEEKS} semanas
        </span>
        <h1 className="font-display text-[26px] font-semibold leading-none tracking-[-0.01em] text-label lg:text-[30px]">
          Progreso
        </h1>
      </header>

      {/* Lo primero: cada reto con su racha en grande. El total de días va
          debajo en una línea, porque suma retos distintos y no le dice a
          nadie cómo va el suyo. */}
      {habits.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="px-6 text-[12.5px] font-bold uppercase tracking-[0.08em] text-label-3 lg:px-0">
            Tus retos
          </h2>
          <RetosEnNumeros habits={habits} />
          <p className="tnum px-6 text-[13px] text-label-2 lg:px-0">
            <span className="font-semibold text-label">{totalClean ?? 0}</span>{" "}
            {totalClean === 1 ? "día cumplido" : "días cumplidos"} en total ·{" "}
            {activeHabits} {activeHabits === 1 ? "hábito" : "hábitos"}
          </p>
        </section>
      )}

      <section
        className="entrar flex flex-col gap-2.5"
        style={{ animationDelay: "0.09s" }}
      >
        <h2 className="px-6 text-[12.5px] lg:px-0 font-bold uppercase tracking-[0.08em] text-label-3">
          Tus impulsos
        </h2>
        <div className="mx-4 lg:mx-0">
          <CravingGrid
            celdas={celdas}
            resumen={
              resumen
                ? {
                    ...resumen,
                    total: Number(resumen.total),
                    resisted: Number(resumen.resisted),
                    caved: Number(resumen.caved),
                    top_trigger_total:
                      resumen.top_trigger_total === null
                        ? null
                        : Number(resumen.top_trigger_total),
                    top_block_total:
                      resumen.top_block_total === null
                        ? null
                        : Number(resumen.top_block_total),
                  }
                : null
            }
          />
        </div>
      </section>

      {/* Dos gráficas en paralelo: en escritorio, apiladas dejaban una barra de
          1100px de ancho por 90 de alto y media pantalla en blanco al lado. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <section
          className="entrar flex flex-col gap-2.5"
          style={{ animationDelay: "0.12s" }}
        >
          <h2 className="px-6 text-[12.5px] lg:px-0 font-bold uppercase tracking-[0.08em] text-label-3">
            Cumplimiento por semana
            <span className="ml-1.5 font-semibold normal-case tracking-normal text-label-3">
              de los días que tocaban
            </span>
          </h2>
          <div className="mx-4 lg:mx-0 flex flex-col gap-3.5 rounded-[22px] bg-card px-3.5 py-4 lg:px-5 lg:py-5">
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

        <section
          className="entrar flex flex-col gap-2.5"
          style={{ animationDelay: "0.18s" }}
        >
          <h2 className="px-6 text-[12.5px] lg:px-0 font-bold uppercase tracking-[0.08em] text-label-3">
            Tu ánimo esta semana
          </h2>
          <div className="mx-4 lg:mx-0 rounded-[22px] bg-card px-3.5 py-4 lg:px-5 lg:py-5">
            <MoodLine points={points} />
          </div>
        </section>
      </div>
    </div>
  );
}
