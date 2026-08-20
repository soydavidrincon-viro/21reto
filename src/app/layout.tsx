import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Antídoto",
  description:
    "Lleva el conteo de los días que llevas sin ese hábito, con bitácora y reacción de cada día.",
  applicationName: "Antídoto",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Antídoto",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // La app se instala en la pantalla de inicio: sin zoom accidental al tocar
  // dos veces, y respetando el notch.
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
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
    <html lang="es" data-theme={attr}>
      <body>{children}</body>
    </html>
  );
}
