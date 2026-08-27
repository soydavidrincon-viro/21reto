"use client";

import { BookOpen, ChartBar, House, User } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Tab bar de iOS: translúcida, fija abajo, icono de 26px con etiqueta debajo.
 *
 * Phosphor y no otro set porque trae pesos: la pestaña activa va en `fill` y
 * las demás en `regular`, que es el par relleno/contorno de iOS. Con un set de
 * un solo peso habría que falsear ese contraste.
 *
 * El padding inferior sale de env(safe-area-inset-bottom) para que en iPhone no
 * quede tapada por el home indicator.
 */

const TABS = [
  { href: "/hoy", label: "Hoy", Icon: House },
  { href: "/bitacora", label: "Bitácora", Icon: BookOpen },
  { href: "/progreso", label: "Progreso", Icon: ChartBar },
  { href: "/perfil", label: "Perfil", Icon: User },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-separator bg-bar pt-[7px] backdrop-blur-xl"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex w-full flex-col items-center gap-[3px] py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
          >
            <Icon
              size={26}
              weight={active ? "fill" : "regular"}
              className={active ? "text-azul" : "text-label-2"}
              aria-hidden="true"
            />
            <span
              className={`text-[10px] tracking-[-0.01em] ${
                active ? "font-semibold text-azul" : "font-medium text-label-2"
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
