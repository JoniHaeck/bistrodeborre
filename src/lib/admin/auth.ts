import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { standaardSlug, type Restaurant } from "@/lib/server/restaurant";
import type { Database } from "@/types/database";

export type AdminDb = SupabaseClient<Database>;

/** Heeft de ingelogde gebruiker toegang tot het beheer (superadmin of lid van minstens één restaurant)? */
export async function heeftBeheertoegang(db: AdminDb): Promise<boolean> {
  const [{ data: superadmin }, { count }] = await Promise.all([
    db.rpc("is_platform_admin"),
    db.from("memberships").select("restaurant_id", { count: "exact", head: true }),
  ]);
  return superadmin === true || (count ?? 0) > 0;
}

/**
 * Database + restaurant voor admin-pagina's en -acties.
 *
 * `db` is de sessie-client van de ingelogde gebruiker: RLS (memberships / platform_admins)
 * beslist welke data zichtbaar en wijzigbaar is. Het restaurant wordt via diezelfde client
 * opgezocht, dus wie geen toegang heeft, krijgt het niet te zien en wordt doorgestuurd.
 * Filter toch elke query op `restaurant.id`: een superadmin ziet anders alle restaurants.
 *
 * Fase 3 haalt de slug uit de URL in plaats van de standaard.
 */
export async function adminContext(slug: string = standaardSlug()): Promise<{ db: AdminDb; restaurant: Restaurant }> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: restaurant, error } = await db
    .from("restaurants")
    .select("id, slug, naam, tijdzone, status")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!restaurant) redirect("/admin/geen-toegang");
  return { db, restaurant };
}
