import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Tables } from "@/types/database";

export type Restaurant = Pick<Tables<"restaurants">, "id" | "slug" | "naam" | "tijdzone" | "status">;

/** Zoekt een restaurant op slug (server-side, per request gecachet). Null als het niet bestaat. */
export const laadRestaurantOpSlug = cache(async (slug: string): Promise<Restaurant | null> => {
  const { data, error } = await createServiceRoleClient()
    .from("restaurants")
    .select("id, slug, naam, tijdzone, status")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
});

/**
 * TIJDELIJK (tot fase 3 – routing): de app kent nog geen restaurant in de URL. Tot dan werken
 * boekingspagina, widget en beheer op één restaurant, ingesteld via STANDAARD_RESTAURANT_SLUG.
 */
export async function standaardRestaurant(): Promise<Restaurant> {
  const slug = process.env.STANDAARD_RESTAURANT_SLUG ?? "bistro-de-borre";
  const restaurant = await laadRestaurantOpSlug(slug);
  if (!restaurant) throw new Error(`Restaurant "${slug}" bestaat niet (STANDAARD_RESTAURANT_SLUG).`);
  return restaurant;
}
