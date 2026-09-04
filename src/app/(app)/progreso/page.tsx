import { Plant } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { CravingGrid } from "@/components/craving-grid";
import { MoodLine } from "@/components/mood-line";
import { WeeklyBars } from "@/components/weekly-bars";
import { lastSevenDays, shiftISO, todayIn, weekdayInitial } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { usuarioActual } from "@/lib/supabase/sesion";
import type { CravingGridCell, CravingSummary, Profile } from "@/lib/types";

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
  const [semanas, { data: entries }, activos, { count: totalClean }, rejilla, resumenImpulsos] =
    await Promise.all([
      supabase.rpc("cumplimiento_semanal", { p_today: today, p_semanas: WEEKS }),
      supabase
        .from("journal_entries")
        .select("entry_date, mood")
        .gte("entry_date", shiftISO(today, -6)),
      supabase
        .from("habits")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("habit_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "success")
        .lte("log_date", today),
      supabase.rpc("get_craving_grid", { p_since: desdeImpulsos }),
      supabase.rpc("get_craving_summary", { p_since: desdeImpulsos }),
    ]);

  const activeHabits = activos.count ?? 0;

  const celdas = ((rejilla.data ?? []) as CravingGridCell[]).map((c) => ({
    ...c,
    total: Number(c.total),
    resisted: Number(c.resisted),
  }));
  const resumen = ((resumenImpulsos.data ?? []) as CravingSummary[])[0] ?? null;

  const weeks = ((semanas.data ?? []) as SemanaRow[]).map((s) => ({
    label: s.semana === WEEKS - 1 ? "Esta" : `S${s.semana + 1}`,
    range: `${s.inicio.slice(8)}/${s.inicio.slice(5, 7)} – ${s.fin.slice(8)}/${s.fin.slice(5, 7)}`,
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

      <section
        className="entrar mx-4 lg:mx-0 flex items-center gap-3.5 rounded-[22px] bg-card px-4 py-4 lg:px-6 lg:py-5"
        style={{ animationDelay: "0.06s" }}
      >
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
              {totalClean === 1 ? "día cumplido" : "días cumplidos"}
            </span>
          </p>
        </div>
        <span className="tnum shrink-0 rounded-lg bg-fill px-2.5 py-1.5 text-[13px] font-semibold text-label-2">
          {activeHabits} {activeHabits === 1 ? "hábito" : "hábitos"}
        </span>
      </section>

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
