import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      ".next-static/**",
      "out/**",
      "node_modules/**",
      ".agents/**",
      ".cdp-browser/**",
      "scripts/ralph/**",
      "next-env.d.ts",
    ],
  },
];
export default config;
