import type { Metadata, Viewport } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
