import Link from "next/link";
import { ProgressRings } from "@/components/progress-rings";

/**
 * La portada.
 *
 * El héroe son los anillos, no una ilustración: es el objeto que la persona va
 * a mirar todos los días, así que verlo llenarse antes de registrarse dice qué
 * hace la app mejor que cualquier frase.
 *
 * Detrás va un resplandor difuso en los colores de los anillos. Sobre negro
 * puro la pantalla se ve muerta, y un degradado de lado a lado sería el cliché
 * de siempre; esto solo levanta el fondo alrededor del héroe.
 *
 * La entrada escalonada es CSS y no JavaScript. La primera versión usaba motion
 * y el servidor mandaba el texto con opacity:0 esperando la hidratación: una
 * carga lenta dejaba la pantalla con los anillos flotando en negro y nada más.
 * Una animación CSS no puede dejar contenido invisible, así que esta pantalla
 * ya no es un componente de cliente.
 */

const RINGS = [
  { color: "blue" as const, value: 18, goal: 21, label: "Sin alcohol" },
  { color: "orange" as const, value: 12, goal: 30, label: "Sin redes" },
  { color: "green" as const, value: 5, goal: 7, label: "Bitácora" },
];

const CLAIMS = [
  ["🎯", "Retos de 21 días", "O de 30, 60 o los que necesites."],
  ["📓", "Bitácora diaria", "Una nota y una reacción por día."],
  ["📈", "Rachas sin castigo", "La recaída se registra, no borra lo andado."],
];

export default function LandingPage() {
  return (
    <main
      className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden px-6 pb-10"
      style={{ paddingTop: "max(env(safe-area-inset-top), 40px)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[4%] size-[400px] -translate-x-1/2 rounded-full opacity-40 blur-[70px]"
        style={{
          background:
            "conic-gradient(from 210deg, var(--c-blue), var(--c-orange), var(--c-green), var(--c-blue))",
        }}
      />

      <header className="entrar relative flex items-center justify-center gap-2 pb-2">
        <span className="text-[19px] font-semibold tracking-[-0.02em] text-label">
          Antídoto
        </span>
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-7 py-6">
        <div className="entrar">
          <ProgressRings rings={RINGS} size={184} />
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <h1
            className="entrar text-balance text-[42px] font-bold leading-[1.03] tracking-[-0.035em] text-label"
            style={{ animationDelay: "0.1s" }}
          >
            Un día a la vez
          </h1>
          <p
            className="entrar text-pretty text-[17px] leading-[1.45] tracking-[-0.01em] text-label-2"
            style={{ animationDelay: "0.18s" }}
          >
            Lleva la cuenta de los días que llevas sin eso. Marcas el día, anotas
            cómo te fue, y la racha crece sola.
          </p>
        </div>

        <ul className="flex w-full flex-col gap-2">
          {CLAIMS.map(([emoji, title, detail], i) => (
            <li
              key={title}
              className="entrar flex items-center gap-3 rounded-2xl bg-card px-4 py-3"
              style={{ animationDelay: `${0.26 + i * 0.07}s` }}
            >
              <span aria-hidden="true" className="text-[24px]">
                {emoji}
              </span>
              <span className="flex flex-col gap-px">
                <span className="text-[16px] font-semibold tracking-[-0.02em] text-label">
                  {title}
                </span>
                <span className="text-[13px] tracking-[-0.01em] text-label-2">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/login"
        className="entrar relative mt-6 flex h-[54px] items-center justify-center rounded-[16px] bg-blue text-[17px] font-semibold tracking-[-0.02em] text-white shadow-[0_8px_24px_-8px_var(--c-blue)] transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
        style={{ animationDelay: "0.5s" }}
      >
        Empezar
      </Link>
    </main>
  );
}
