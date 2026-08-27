import { TabBar } from "@/components/tab-bar";

/**
 * Shell de las pantallas con sesión.
 *
 * En teléfono es una columna con la barra abajo. En escritorio, el carril
 * lateral empuja el contenido y la columna se ensancha: estirar la columna de
 * 430px en una pantalla de 1400 era lo que hacía que se viera como una app de
 * móvil abierta en el sitio equivocado.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <TabBar />
      {/* `w-full` se anula en escritorio a propósito: con el margen de 232px del
          carril, un ancho del 100% suma 1672px en una pantalla de 1440 y deja
          barra de desplazamiento horizontal. `w-auto` llena lo que sobra. */}
      <main className="app-shell mx-auto w-full max-w-[430px] lg:ml-[232px] lg:w-auto lg:max-w-none lg:px-8">
        <div className="lg:mx-auto lg:max-w-[1180px]">{children}</div>
      </main>
    </>
  );
}
