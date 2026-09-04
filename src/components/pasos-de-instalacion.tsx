import { Export, Plus } from "@phosphor-icons/react";

/**
 * Los tres pasos para poner Antídoto en la pantalla de inicio de un iPhone.
 *
 * Viven aparte porque se enseñan en tres sitios: al terminar el onboarding,
 * en Perfil y en la hoja de recordatorios. Safari no ofrece el botón de
 * instalar, así que hay que decírselo a la persona con las palabras de su
 * menú.
 */
export function PasosDeInstalacion({ ultimo = "Abre Antídoto desde ahí" }: { ultimo?: string }) {
  return (
    <ol className="flex flex-col gap-2 text-[14px] leading-[1.4] text-label">
      <li className="flex items-center gap-2.5">
        <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-[12px] font-bold">
          1
        </span>
        Toca <Export size={17} weight="bold" aria-hidden="true" /> abajo en Safari
      </li>
      <li className="flex items-center gap-2.5">
        <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-[12px] font-bold">
          2
        </span>
        Baja y toca <Plus size={16} weight="bold" aria-hidden="true" /> Añadir a inicio
      </li>
      <li className="flex items-center gap-2.5">
        <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-[12px] font-bold">
          3
        </span>
        {ultimo}
      </li>
    </ol>
  );
}
