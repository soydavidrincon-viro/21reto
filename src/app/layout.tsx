import type { Metadata, Viewport } from "next";
import { Figtree, Fredoka } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

/**
 * Fredoka para títulos y números: la app cuenta días, y los números son la
 * mitad de lo que se lee en pantalla. Figtree para el resto — neutra sin ser
 * Inter.
 *
 * next/font las descarga en el build y las sirve desde nuestro dominio, así
 * que no hay petición a Google en tiempo de carga ni salto de fuente.
 */
const display = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--f-display",
  display: "swap",
});

const ui = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Antídoto",
  description:
    "Lleva el conteo de los días que llevas sin ese hábito, con bitácora y reacción de cada día.",
  applicationName: "Antídoto",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Antídoto",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sin maximumScale: bloquear el zoom deja fuera a quien necesita agrandar
  // para leer, y en iOS es sospechoso habitual de rarezas al enfocar campos.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F6FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0E14" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // El tema se estampa en el servidor desde la cookie. Hacerlo al hidratar
  // dejaría ver un fogonazo claro antes de que la app se ponga oscura.
  const theme = (await cookies()).get("theme")?.value;
  const attr = theme === "light" || theme === "dark" ? theme : undefined;

  return (
    <html lang="es" data-theme={attr} className={`${display.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
