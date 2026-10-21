import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Supabase-client voor Server Components, Server Actions en Route Handlers.
 * Gebruikt de publishable/anon key + de sessie-cookie van de ingelogde
 * beheerder (nodig voor admin-auth en RLS-policies voor `authenticated`).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Genegeerd: kan optreden wanneer setAll wordt aangeroepen vanuit een
            // Server Component. Dit is onschadelijk zolang proxy.ts de
            // sessie elders ververst.
          }
        },
      },
    },
  );
}
