"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Tab bar de iOS: translúcida, fija abajo, icono de 26px con etiqueta debajo.
 * El padding inferior sale de env(safe-area-inset-bottom) para que en iPhone no
 * quede tapada por el home indicator.
 */

type Tab = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const stroke = {
  fill: "none",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TABS: Tab[] = [
  {
    href: "/hoy",
    label: "Hoy",
    icon: (active) =>
      active ? (
        <path d="M12 3.1 3 10.4V20a1 1 0 0 0 1 1h5.2v-5.6h5.6V21H20a1 1 0 0 0 1-1v-9.6z" />
      ) : (
        <>
          <path d="M3.4 10.6 12 3.6l8.6 7" {...stroke} />
          <path d="M5.6 9.4V20a1 1 0 0 0 1 1h10.8a1 1 0 0 0 1-1V9.4" {...stroke} />
        </>
      ),
  },
  {
    href: "/bitacora",
    label: "Bitácora",
    icon: (active) =>
      active ? (
        <path d="M4.5 5.2A2.2 2.2 0 0 1 6.7 3H19.5v18H6.7a2.2 2.2 0 0 1-2.2-2.2zM9 3v18" />
      ) : (
        <>
          <path d="M4.5 5.2A2.2 2.2 0 0 1 6.7 3H19.5v18H6.7a2.2 2.2 0 0 1-2.2-2.2z" {...stroke} />
          <path d="M9 3v18" {...stroke} />
        </>
      ),
  },
  {
    href: "/progreso",
    label: "Progreso",
    icon: (active) =>
      active ? (
        <>
          <rect x="3.6" y="13.4" width="3.6" height="7.4" rx="1.6" />
          <rect x="10.2" y="3.6" width="3.6" height="17.2" rx="1.6" />
          <rect x="16.8" y="9.4" width="3.6" height="11.4" rx="1.6" />
        </>
      ) : (
        <>
          <path d="M5.4 20v-6" {...stroke} />
          <path d="M12 20V4.5" {...stroke} />
          <path d="M18.6 20v-9.5" {...stroke} />
        </>
      ),
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: (active) =>
      active ? (
        <path d="M12 12.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4.6 20.6c0-4 3.3-6.8 7.4-6.8s7.4 2.8 7.4 6.8z" />
      ) : (
        <>
          <circle cx="12" cy="8" r="3.8" {...stroke} />
          <path d="M4.8 20.2c0-3.8 3.2-6.4 7.2-6.4s7.2 2.6 7.2 6.4" {...stroke} />
        </>
      ),
  },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-separator bg-bar pt-[7px] backdrop-blur-xl"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="flex w-full flex-col items-center gap-[3px] py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={active ? "fill-blue" : "fill-none stroke-label-2"}
            >
              {tab.icon(active)}
            </svg>
            <span
              className={`text-[10px] tracking-[-0.01em] ${
                active ? "font-semibold text-blue" : "font-medium text-label-2"
              }`}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
