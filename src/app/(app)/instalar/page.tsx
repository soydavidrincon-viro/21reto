"use client";

import { DeviceMobile } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Companion } from "@/components/companion";
import { PasosDeInstalacion } from "@/components/pasos-de-instalacion";
import { iphoneSinInstalar } from "@/lib/push";

/**
 * La pantalla de instalar, justo después del onboarding.
 *
 * Solo tiene algo que decir en un iPhone abierto desde Safari sin instalar:
 * ahí los avisos no llegan y la app se usa como una pestaña. A todo el que
 * no esté en ese caso lo manda a Hoy sin enseñarle nada. La decisión se toma
 * en el navegador porque solo él sabe si está instalado.
 *
 * Es de cliente entera y no depende de la sesión: el proxy ya la exigió.
 */

const sinCambios = () => () => {};
let cache: boolean | null = null;
function leer() {
  cache ??= iphoneSinInstalar();
  return cache;
}

export default function InstalarPage() {
  const router = useRouter();
  const aplica = useSyncExternalStore(sinCambios, leer, () => null);

  useEffect(() => {
    if (aplica === false) router.replace("/hoy");
  }, [aplica, router]);

  if (!aplica) return null;

  // Un `div` y no un `main`: el shell de la app ya pone el suyo.
  return (
    <div
      className="mx-auto flex min-h-[70svh] w-full max-w-[430px] flex-col gap-6 px-6 pb-6 pt-8"
    >
      <div className="flex items-center gap-4">
        <Companion who="brote" size={72} mood="contento" sombra={false} className="flota shrink-0" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-balance font-display text-[30px] font-semibold leading-[1.06] tracking-[-0.02em] text-label">
            Ponla en tu pantalla de inicio
          </h1>
          <p className="text-pretty text-[15px] leading-[1.45] text-label-2">
            Así se abre como una app y te pueden llegar los recordatorios. En
            iPhone no hay otra forma.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[22px] bg-fill p-4">
        <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-label-3">
          <DeviceMobile size={16} weight="fill" aria-hidden="true" />
          Un minuto
        </span>
        <PasosDeInstalacion ultimo="Abre Antídoto desde ahí. Tus datos ya están guardados." />
      </div>

      <p className="text-pretty text-[13px] leading-[1.45] text-label-2">
        Si prefieres seguir en Safari, todo funciona igual menos los avisos.
        Puedes instalarla después desde Perfil.
      </p>

      <Link
        href="/hoy"
        className="pulsable mt-auto flex h-[54px] items-center justify-center rounded-[16px] bg-fill text-[16px] font-semibold text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
      >
        Ahora no
      </Link>
    </div>
  );
}
