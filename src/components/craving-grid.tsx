import {
  CRAVING_BLOCKS,
  DOW_LABELS,
  MIN_PARA_HABLAR,
  TRIGGER_BY_KEY,
  type CravingGridCell,
  type CravingSummary,
} from "@/lib/types";

/** Lunes primero. Postgres cuenta el domingo como 0, la app empieza el lunes. */
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

/** Etiquetas cortas para las columnas; las largas no caben en seis columnas. */
const BLOQUES_CORTOS = ["0–4", "4–8", "8–12", "12–16", "16–20", "20–24"];

/**
 * La rejilla de impulsos: día de la semana × bloque de cuatro horas.
 *
 * Esta es la única pantalla de la app que le dice a alguien algo que no sabía.
 * Por eso no habla hasta tener con qué: con cuatro registros cualquier casilla
 * oscura es azar, y afirmar "los martes son tu hora difícil" con esa muestra
 * sería inventarse un patrón. Hasta llegar al mínimo enseña cuántos faltan.
 */
export function CravingGrid({
  celdas,
  resumen,
}: {
  celdas: CravingGridCell[];
  resumen: CravingSummary | null;
}) {
  const total = resumen?.total ?? 0;

  if (total < MIN_PARA_HABLAR) {
    const faltan = MIN_PARA_HABLAR - total;
    return (
      <div className="flex flex-col gap-1.5 rounded-[22px] bg-card px-4 py-5">
        <p className="text-pretty text-[15px] leading-[1.45] text-label">
          {total === 0
            ? "Todavía no has registrado ningún impulso."
            : `Llevas ${total} ${total === 1 ? "impulso registrado" : "impulsos registrados"}.`}
        </p>
        <p className="text-pretty text-[13.5px] leading-[1.45] text-label-2">
          {total === 0
            ? "Cuando te dé, toca el botón de emergencia en Hoy. Con unos cuantos registros esto te muestra a qué horas y con qué se te aparecen."
            : `Con ${faltan} ${faltan === 1 ? "más" : "más"} ya te muestro a qué horas y con qué se te aparecen.`}
        </p>
      </div>
    );
  }

  const porClave = new Map(celdas.map((c) => [`${c.dow}-${c.block}`, c]));
  const maximo = Math.max(...celdas.map((c) => c.total), 1);

  const disparador = resumen?.top_trigger
    ? TRIGGER_BY_KEY.get(resumen.top_trigger)?.label
    : null;

  return (
    <div className="flex flex-col gap-3.5 rounded-[22px] bg-card px-3.5 py-4 lg:px-5 lg:py-5">
      <div className="flex flex-col gap-1">
        <p className="flex items-baseline gap-1.5">
          <span className="tnum font-display text-[26px] font-bold tracking-[-0.03em] text-menta">
            {resumen!.resisted}
          </span>
          <span className="text-[14px] tracking-[-0.01em] text-label-2">
            de {total} aguantados
          </span>
        </p>
        {resumen?.top_dow !== null && resumen?.top_block !== null && (
          <p className="text-pretty text-[13.5px] leading-[1.45] text-label-2">
            Tu hora difícil:{" "}
            <b className="font-semibold text-label">
              {DOW_LABELS[resumen!.top_dow!]} de{" "}
              {CRAVING_BLOCKS[resumen!.top_block!]}
            </b>
            {disparador && (
              <>
                . Tu disparador más común es{" "}
                <b className="font-semibold text-label">
                  {disparador.toLowerCase()}
                </b>{" "}
                ({resumen!.top_trigger_total} de {total}).
              </>
            )}
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        {/* El ancho se topa: estirada a 1100px cada casilla es una franja
              de 150 × 28 y la rejilla deja de leerse como rejilla. */}
        <table className="w-full min-w-[280px] max-w-[560px] border-separate border-spacing-1">
          <caption className="sr-only">
            Impulsos por día de la semana y franja horaria
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-9" />
              {BLOQUES_CORTOS.map((etiqueta, i) => (
                <th
                  key={etiqueta}
                  scope="col"
                  className="tnum pb-0.5 text-[9.5px] font-semibold text-label-3"
                >
                  <span className="sr-only">{CRAVING_BLOCKS[i]}</span>
                  <span aria-hidden="true">{etiqueta}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ORDEN.map((dow) => (
              <tr key={dow}>
                <th
                  scope="row"
                  className="pr-1 text-right text-[10.5px] font-semibold text-label-3"
                >
                  {DOW_LABELS[dow]}
                </th>
                {CRAVING_BLOCKS.map((_, block) => {
                  const celda = porClave.get(`${dow}-${block}`);
                  const n = celda?.total ?? 0;
                  // La opacidad va de 0.18 a 1 sobre el máximo: con un salto
                  // desde 0 la casilla de un solo impulso era invisible.
                  const fuerza = n === 0 ? 0 : 0.18 + (n / maximo) * 0.82;

                  return (
                    <td key={block} className="p-0">
                      <span
                        title={
                          n === 0
                            ? `${DOW_LABELS[dow]}, ${CRAVING_BLOCKS[block]}: sin impulsos`
                            : `${DOW_LABELS[dow]}, ${CRAVING_BLOCKS[block]}: ${n} ${n === 1 ? "impulso" : "impulsos"}, ${celda!.resisted} aguantados`
                        }
                        className={`block h-7 w-full rounded-md ${n === 0 ? "bg-fill" : "bg-naranja"}`}
                        style={n === 0 ? undefined : { opacity: fuerza }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] leading-[1.35] text-label-3">
        Cuanto más naranja, más impulsos en esa franja.
      </p>
    </div>
  );
}
