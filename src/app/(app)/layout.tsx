import { TabBar } from "@/components/tab-bar";

/**
 * Shell de las pantallas con sesión. El padding inferior deja sitio a la tab
 * bar fija: 83px de barra más el safe area del iPhone.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <main
        className="mx-auto min-h-dvh w-full max-w-[430px]"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 12px)",
          paddingBottom: "calc(83px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>
      <TabBar />
    </>
  );
}
