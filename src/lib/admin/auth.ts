import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { standaardRestaurant } from "@/lib/server/restaurant";

export const isAdmin = (user: User | null | undefined) => user?.app_metadata?.role === "admin";

/** Controleert de sessie (server-side gevalideerd) en stuurt niet-beheerders naar de login. */
export async function requireAdmin() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!isAdmin(user)) redirect("/admin/login");
  return user!;
}

/**
 * Database + restaurant voor admin-pagina's en -acties, enkel na een geslaagde beheerderscontrole.
 * Elke query moet filteren op `restaurant.id` (en elke insert het meegeven).
 * Fase 2 vervangt de service-client door de sessie-client (RLS via memberships);
 * fase 3 haalt het restaurant uit de URL in plaats van de standaard.
 */
export async function adminContext() {
  await requireAdmin();
  return { db: createServiceRoleClient(), restaurant: await standaardRestaurant() };
}
