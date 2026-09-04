import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /*
     * Phosphor se importa por nombre desde el índice del paquete en todos los
     * componentes de cliente, y ese índice trae miles de iconos. Next sabe
     * recortarlo a los que se usan si se le dice qué paquete; sin esto, cada
     * icono de más costaba en el bundle inicial. Los componentes de servidor
     * ya importan de `/dist/ssr`, que no tiene ese problema.
     */
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  // Sin `images.remotePatterns`: la única `<Image>` remota —la foto de
  // perfil— va con `unoptimized`, así que el optimizador nunca se llama y la
  // lista de dominios era configuración muerta.
};

export default nextConfig;
