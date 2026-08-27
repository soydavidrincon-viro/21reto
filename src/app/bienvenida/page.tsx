import { HabitForm } from "@/components/habit-form";

export const metadata = { title: "Bienvenida · Antídoto" };

export default function BienvenidaPage() {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-5 pb-9"
      style={{ paddingTop: "max(env(safe-area-inset-top), 56px)" }}
    >
      <header className="flex flex-col gap-[7px] px-5">
        <h1 className="text-balance font-display text-[34px] font-semibold leading-[1.06] tracking-[-0.02em] text-label">
          Tu primer reto
        </h1>
        <p className="text-pretty text-[15px] leading-[1.4] tracking-[-0.01em] text-label-2">
          Algo que quieras dejar, o algo que quieras empezar. Elige lo que más
          te pesa ahora; puedes agregar otros después.
        </p>
      </header>

      <HabitForm finishOnboarding />
    </main>
  );
}
