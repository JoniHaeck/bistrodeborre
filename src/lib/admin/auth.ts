import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const isAdmin = (user: User | null | undefined) => user?.app_metadata?.role === "admin";

/** Controleert de sessie (server-side gevalideerd) en stuurt niet-beheerders naar de login. */
export async function requireAdmin() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!isAdmin(user)) redirect("/admin/login");
  return user!;
}

/** Service-client, enkel na een geslaagde beheerderscontrole. Elke admin-pagina en -actie moet dit gebruiken. */
export async function adminDb() {
  await requireAdmin();
  return createServiceRoleClient();
}
