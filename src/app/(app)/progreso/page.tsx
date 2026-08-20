export const metadata = { title: "Progreso · Antídoto" };

export default function ProgresoPage() {
  return (
    <div className="flex flex-col gap-4 pt-11">
      <h1 className="px-5 text-[34px] font-bold leading-[1.08] tracking-[-0.026em] text-label">
        Progreso
      </h1>
      <p className="px-5 text-[15px] leading-[1.4] tracking-[-0.01em] text-label-2">
        Cumplimiento por semana, evolución del ánimo y días limpios acumulados.
        Todavía no está construida.
      </p>
    </div>
  );
}
