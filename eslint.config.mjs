import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Multi-tenant veiligheid: het beheer werkt met de sessie-client (RLS per restaurant).
  // De service-role key omzeilt RLS en mag daar dus nooit rechtstreeks gebruikt worden.
  {
    files: ["src/app/app/**", "src/app/platform/**", "src/app/login/**", "src/app/api/r/*/admin/**", "src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/service",
              message: "Geen service-role client in het beheer: gebruik adminContext() (RLS per restaurant).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
