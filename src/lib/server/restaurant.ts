import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Tables } from "@/types/database";

export type Restaurant = Pick<Tables<"restaurants">, "id" | "slug" | "naam" | "tijdzone" | "status">;

/** Slugs die niet als restaurant gebruikt mogen worden (botsen met routes van de app). */
export const GERESERVEERDE_SLUGS = [
  "admin", "annuleren", "api", "app", "login", "logout", "platform", "registreren",
  "reserveren", "static", "w", "widget", "www", "_next", "favicon.ico",
] as const;

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Zoekt een restaurant op slug (server-side, per request gecachet). Null als het niet bestaat. */
export const laadRestaurantOpSlug = cache(async (slug: string): Promise<Restaurant | null> => {
  if (!SLUG.test(slug)) return null;
  const { data, error } = await createServiceRoleClient()
    .from("restaurants")
    .select("id, slug, naam, tijdzone, status")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
});

/** Kunnen gasten online boeken? Een opgezegd restaurant aanvaardt geen nieuwe online boekingen meer. */
export const isBoekbaar = (r: Restaurant) => r.status !== "opgezegd";

/** Restaurant voor publieke routes (boekingspagina, widget, publieke API): bestaat én is boekbaar. */
export async function publiekRestaurant(slug: string): Promise<Restaurant | null> {
  const r = await laadRestaurantOpSlug(slug);
  return r && isBoekbaar(r) ? r : null;
}
