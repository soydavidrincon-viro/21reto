import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Next 16 quitó `next lint`, y con él la ilusión de que el proyecto estaba
 * revisado: el script seguía en package.json, fallaba con "Invalid project
 * directory" y salía con código 0, así que `npm run lint` no leyó una sola
 * línea de código en todo el desarrollo. Esto es el reemplazo real.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
