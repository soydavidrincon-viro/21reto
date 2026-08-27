"use client";

import { BookOpen, ChartBar, House, User } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Isotipo } from "@/components/logo";

/**
 * La navegación cambia de forma con el ancho, no de contenido.
 *
 * En teléfono es una barra abajo, donde llega el pulgar. En escritorio esa
 * barra sería absurda —el ratón no vive en el borde inferior de la pantalla—
 * así que se convierte en un carril lateral fijo. Un solo componente para no
 * mantener dos navegaciones que se desincronizan.
 */

const TABS = [
  { href: "/hoy", label: "Hoy", Icon: House },
  { href: "/bitacora", label: "Bitácora", Icon: BookOpen },
  { href: "/progreso", label: "Progreso", Icon: ChartBar },
  { href: "/perfil", label: "Perfil", Icon: User },
];

export function TabBar() {
  const pathname = usePathname();
  const activo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-separator bg-bar pt-[7px] backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
      >
        {TABS.map(({ href, label, Icon }) => {
          const active = activo(href);
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
                className={`text-[10px] ${active ? "font-semibold text-azul" : "font-medium text-label-2"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <nav
        aria-label="Secciones"
        className="fixed inset-y-0 left-0 z-50 hidden w-[232px] flex-col gap-1 border-r border-separator bg-card px-4 py-7 lg:flex"
      >
        <Link
          href="/hoy"
          className="mb-6 flex items-center gap-2.5 px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
        >
          <Isotipo size={30} />
          <span className="font-display text-[19px] font-semibold text-label">Antídoto</span>
        </Link>

        {TABS.map(({ href, label, Icon }) => {
          const active = activo(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`pulsable flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${
                active
                  ? "bg-azul font-semibold text-azul-tinta"
                  : "font-medium text-label-2 hover:bg-fill"
              }`}
            >
              <Icon size={22} weight={active ? "fill" : "regular"} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
