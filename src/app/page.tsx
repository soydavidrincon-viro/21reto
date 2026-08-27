import { ArrowRight, Notebook, Target, TrendUp } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Companion } from "@/components/companion";
import { Logo } from "@/components/logo";
import { ProgressRings } from "@/components/progress-rings";

/**
 * La portada.
 *
 * El héroe son los anillos con el compañero asomado: es el objeto que la
 * persona va a mirar todos los días, así que verlo funcionar antes de
 * registrarse dice qué hace la app mejor que cualquier frase.
 *
 * La entrada escalonada es CSS y no JavaScript. La primera versión usaba motion
 * y el servidor mandaba el texto con opacity:0 esperando la hidratación: una
 * carga lenta dejaba la pantalla con los anillos flotando en negro y nada más.
 * Una animación CSS no puede dejar contenido invisible.
 */

const RINGS = [
  { color: "blue" as const, value: 18, goal: 21, label: "Sin alcohol" },
  { color: "orange" as const, value: 12, goal: 30, label: "Sin redes" },
  { color: "green" as const, value: 5, goal: 7, label: "Bitácora" },
];

const CLAIMS = [
  {
    Icon: Target,
    color: "var(--c-azul)",
    tinta: "var(--c-azul-tinta)",
    title: "Retos de 21 días",
    detail: "O de 30, 60 o los que necesites.",
  },
  {
    Icon: Notebook,
    color: "var(--c-naranja)",
    tinta: "var(--c-naranja-tinta)",
    title: "Bitácora diaria",
    detail: "Una nota y una reacción por día.",
  },
  {
    Icon: TrendUp,
    color: "var(--c-menta)",
    tinta: "var(--c-menta-tinta)",
    title: "Rachas sin castigo",
    detail: "La recaída se registra, no borra lo andado.",
  },
];

export default function LandingPage() {
  return (
    <main
      className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden px-6 pb-10"
      style={{ paddingTop: "max(env(safe-area-inset-top), 32px)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[2%] size-[380px] -translate-x-1/2 rounded-full opacity-30 blur-[80px]"
        style={{
          background:
            "conic-gradient(from 210deg, var(--c-azul), var(--c-naranja), var(--c-menta), var(--c-azul))",
        }}
      />

      <header className="entrar relative flex justify-center pb-1">
        <Logo size={26} />
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 py-4">
        <div className="entrar relative">
          <ProgressRings rings={RINGS} size={186} />
          <Companion
            who="brote"
            size={78}
            mood="contento"
            sombra={false}
            className="flota absolute -bottom-2 -right-5"
          />
        </div>

        <div className="flex flex-col items-center gap-2.5 text-center">
          <h1
            className="entrar text-balance font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] text-label"
            style={{ animationDelay: "0.1s" }}
          >
            Un día a la vez
          </h1>
          <p
            className="entrar text-pretty text-[16.5px] leading-[1.45] text-label-2"
            style={{ animationDelay: "0.18s" }}
          >
            Lleva la cuenta de los días que llevas sin eso. Marcas el día, anotas
            cómo te fue, y la racha crece sola.
          </p>
        </div>

        <ul className="flex w-full flex-col gap-2">
          {CLAIMS.map(({ Icon, color, tinta, title, detail }, i) => (
            <li
              key={title}
              className="entrar flex items-center gap-3 rounded-[20px] bg-card px-4 py-3"
              style={{ animationDelay: `${0.26 + i * 0.07}s` }}
            >
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: color, color: tinta }}
              >
                <Icon size={21} weight="fill" aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-px">
                <span className="font-display text-[16px] font-semibold text-label">
                  {title}
                </span>
                <span className="text-[13px] text-label-2">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/login"
        className="entrar pulsable relative mt-5 flex h-[56px] items-center justify-center gap-2 rounded-[18px] bg-azul font-display text-[17px] font-semibold text-azul-tinta shadow-[0_10px_28px_-10px_var(--c-azul)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        style={{ animationDelay: "0.5s" }}
      >
        Empezar
        <ArrowRight size={19} weight="bold" aria-hidden="true" />
      </Link>
    </main>
  );
}
