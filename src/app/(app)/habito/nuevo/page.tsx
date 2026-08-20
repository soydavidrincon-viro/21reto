import { HabitForm } from "@/components/habit-form";

export const metadata = { title: "Nuevo hábito · Antídoto" };

export default function NuevoHabitoPage() {
  return (
    <div className="flex min-h-full flex-col gap-5 pt-11">
      <header className="flex flex-col gap-[7px] px-5">
        <h1 className="text-balance text-[34px] font-bold leading-[1.08] tracking-[-0.026em] text-label">
          Nuevo hábito
        </h1>
        <p className="text-pretty text-[15px] leading-[1.4] tracking-[-0.01em] text-label-2">
          Cada hábito lleva su propio reto y su propia racha.
        </p>
      </header>

      <HabitForm />
    </div>
  );
}
