import { HabitForm } from "@/components/habit-form";

export const metadata = { title: "Bienvenida · Antídoto" };

export default function BienvenidaPage() {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-5 pb-9"
      style={{ paddingTop: "max(env(safe-area-inset-top), 56px)" }}
    >
      <header className="flex flex-col gap-[7px] px-5">
        <h1 className="text-balance text-[34px] font-bold leading-[1.08] tracking-[-0.026em] text-label">
          ¿Qué quieres dejar?
        </h1>
        <p className="text-pretty text-[15px] leading-[1.4] tracking-[-0.01em] text-label-2">
          Elige lo que más te está pesando ahora. Puedes agregar otros después.
        </p>
      </header>

      <HabitForm finishOnboarding />
    </main>
  );
}
