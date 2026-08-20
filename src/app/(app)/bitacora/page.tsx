export const metadata = { title: "Bitácora · Antídoto" };

export default function BitacoraPage() {
  return (
    <div className="flex flex-col gap-4 pt-11">
      <h1 className="px-5 text-[34px] font-bold leading-[1.08] tracking-[-0.026em] text-label">
        Bitácora
      </h1>
      <p className="px-5 text-[15px] leading-[1.4] tracking-[-0.01em] text-label-2">
        Aquí va a quedar el registro de cada día: cómo te sentiste y qué
        escribiste. Todavía no está construida.
      </p>
    </div>
  );
}
