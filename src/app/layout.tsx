import type { Metadata, Viewport } from "next";
import { Figtree, Fredoka } from "next/font/google";
import { TemaGuardia } from "@/components/tema";
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

/**
 * El tema se estampa desde un script en línea, no leyendo la cookie en el
 * servidor.
 *
 * Leerla aquí con `cookies()` funcionaba, pero tenía un precio que no se veía:
 * saca del prerenderizado **a toda la app**. Con eso, la portada y el login
 * —que no dependen de ningún dato de quien mira— se renderizaban en un lambda
 * en cada visita. Medido en producción: 0.2s con el lambda caliente y 2.2s con
 * el lambda frío, que es de donde salía el LCP de casi tres segundos. Y el
 * lambda se enfría solo, así que el que se lo come es justo el visitante que
 * llega de nuevas.
 *
 * El script corre mientras el navegador parsea el HTML, o sea antes del primer
 * pintado: no hay fogonazo claro, que era lo que el render en servidor venía a
 * evitar. Sin cookie válida no se pone nada, y "nada" significa seguir al
 * sistema — de eso ya se encarga el @media de globals.css.
 */
const TEMA_INMEDIATO = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=(light|dark)/);if(m)document.documentElement.setAttribute("data-theme",m[1])}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning porque el script de arriba toca `data-theme`
    // antes de que React hidrate: sin esto React vería el atributo que él no
    // puso y trataría la diferencia como un error de hidratación.
    <html
      lang="es"
      className={`${display.variable} ${ui.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_INMEDIATO }} />
      </head>
      <body>
        <TemaGuardia />
        {children}
      </body>
    </html>
  );
}
