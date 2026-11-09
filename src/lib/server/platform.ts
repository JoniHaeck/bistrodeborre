import { createServiceRoleClient } from "@/lib/supabase/service";
import { GERESERVEERDE_SLUGS } from "@/lib/server/restaurant";

/*
 * Platformbeheer (enkel aanroepen NA een superadmin-controle via de sessie, zie /platform).
 * Gebruikt de service-role key: restaurants aanmaken en accounts opzoeken kan niet via RLS.
 */

export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function slugFout(slug: string): string | null {
  if (!SLUG_REGEX.test(slug)) return "De slug mag enkel kleine letters, cijfers en koppeltekens bevatten (3–40 tekens).";
  if ((GERESERVEERDE_SLUGS as readonly string[]).includes(slug)) return `"${slug}" is gereserveerd. Kies een andere slug.`;
  return null;
}

/** Maakt een slug van een naam: "Café 't Hoekske" → "cafe-t-hoekske". */
export function maakSlug(naam: string): string {
  return naam
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export type KoppelResultaat = { ok: true } | { ok: false; reden: "geen_account" | "fout" };

/** Koppelt een bestaand account (op e-mail) als beheerder aan een restaurant. */
export async function koppelBeheerder(
  restaurantId: string,
  email: string,
  rol: "eigenaar" | "beheerder" = "eigenaar",
): Promise<KoppelResultaat> {
  const db = createServiceRoleClient();
  const { data: userId, error } = await db.rpc("user_id_voor_email", { p_email: email });
  if (error) {
    console.error("Account opzoeken mislukt", error);
    return { ok: false, reden: "fout" };
  }
  if (!userId) return { ok: false, reden: "geen_account" };
  const { error: e2 } = await db
    .from("memberships")
    .upsert({ user_id: userId, restaurant_id: restaurantId, rol }, { onConflict: "user_id,restaurant_id" });
  if (e2) {
    console.error("Beheerder koppelen mislukt", e2);
    return { ok: false, reden: "fout" };
  }
  return { ok: true };
}

/** Maakt een restaurant aan (settings worden automatisch aangemaakt door een databasetrigger). */
export async function maakRestaurant(input: { naam: string; slug: string; email: string | null }) {
  const { data, error } = await createServiceRoleClient()
    .from("restaurants")
    .insert({ naam: input.naam, slug: input.slug, email: input.email, status: "proef" })
    .select("id, slug")
    .single();
  return { data, error };
}
