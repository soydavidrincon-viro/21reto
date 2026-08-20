import Link from "next/link";

export default function LandingPage() {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-10"
      style={{ paddingTop: "max(env(safe-area-inset-top), 72px)" }}
    >
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-balance text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-label">
            Un día a la vez
          </h1>
          <p className="text-pretty text-[17px] leading-[1.45] tracking-[-0.01em] text-label-2">
            Antídoto lleva la cuenta de los días que llevas sin ese hábito.
            Marcas el día, anotas cómo te sentiste, y la racha crece sola.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {[
            ["🎯", "Retos de 21 días", "O de 30, 60 o los que necesites."],
            ["📓", "Bitácora diaria", "Una nota y una reacción por día."],
            ["📈", "Tu progreso", "Rachas, cumplimiento y recaídas sin castigo."],
          ].map(([emoji, title, detail]) => (
            <li key={title} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
              <span aria-hidden="true" className="text-[24px]">
                {emoji}
              </span>
              <span className="flex flex-col gap-px">
                <span className="text-[17px] font-medium tracking-[-0.02em] text-label">
                  {title}
                </span>
                <span className="text-[13px] tracking-[-0.01em] text-label-2">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/login"
          className="flex h-[50px] items-center justify-center rounded-[14px] bg-blue text-[17px] font-semibold tracking-[-0.02em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
        >
          Empezar
        </Link>
        <p className="text-pretty text-center text-[12px] leading-[1.35] text-label-2">
          Antídoto acompaña tu proceso. No sustituye atención profesional.
        </p>
      </div>
    </main>
  );
}
