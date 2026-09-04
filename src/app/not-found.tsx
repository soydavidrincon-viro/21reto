import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = { title: "No está · Antídoto" };

/**
 * El 404 con la cara de la app. Se llega aquí desde `notFound()` en el detalle
 * de un hábito que ya no existe —borrado desde otro dispositivo, un enlace
 * viejo— y desde cualquier URL inventada. Antes salía la página de Next en
 * inglés, fuera del shell.
 */
export default function NotFound() {
  return (
    <main
      className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ paddingTop: "max(env(safe-area-inset-top), 40px)" }}
    >
      <Logo size={26} />
      <div className="flex flex-col gap-2">
        <h1 className="text-balance font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-label">
          Esto ya no está aquí
        </h1>
        <p className="text-pretty text-[15px] leading-[1.45] text-label-2">
          Puede que el reto se haya borrado o que el enlace esté viejo. Lo que
          llevas sigue en su sitio.
        </p>
      </div>
      <Link
        href="/hoy"
        className="pulsable flex h-[54px] w-full items-center justify-center rounded-[16px] bg-azul text-[17px] font-semibold tracking-[-0.02em] text-azul-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
      >
        Ir a Hoy
      </Link>
    </main>
  );
}
