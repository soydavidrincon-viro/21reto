/**
 * Cumplimiento por semana. Una sola serie, así que una sola tonalidad: colorear
 * las semanas perfectas de otro color convertiría la gráfica en un semáforo y
 * haría creer que hay dos categorías donde solo hay una medida.
 */
export function WeeklyBars({
  weeks,
}: {
  weeks: { label: string; value: number | null; range: string }[];
}) {
  const height = 106;

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex h-[136px] items-end gap-2.5">
        {weeks.map((week) => {
          const empty = week.value === null;
          const bar = empty ? 3 : Math.max(4, Math.round((week.value! / 100) * height));

          return (
            <li
              key={week.label}
              className="flex h-full w-full flex-col items-center justify-end gap-1.5"
            >
              <span className="tnum text-[10.5px] font-semibold text-label-2">
                {empty ? "—" : `${week.value}%`}
              </span>
              <span
                title={
                  empty
                    ? `${week.range}: sin registros`
                    : `${week.range}: ${week.value}% de cumplimiento`
                }
                style={{ height: `${bar}px` }}
                className={`block w-full rounded-t ${empty ? "bg-fill" : "bg-blue"}`}
              />
              <span className="text-[10.5px] font-medium text-label-2">{week.label}</span>
            </li>
          );
        })}
      </ol>

      <details className="text-[13px] text-label-2">
        <summary className="cursor-pointer">Ver los números</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.02em]">
              <th scope="col" className="py-1 font-semibold">Semana</th>
              <th scope="col" className="py-1 font-semibold">Cumplimiento</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.label} className="border-t border-separator">
                <td className="py-1">{week.range}</td>
                <td className="tnum py-1">{week.value === null ? "—" : `${week.value}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
