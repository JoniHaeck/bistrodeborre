import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { datumTijdslotNaarUtc } from "@/lib/time";

export function gastKanWijzigen(datum: string, tijdslot: string, tijdzone: string) {
  return datumTijdslotNaarUtc(datum, tijdslot.slice(0, 5), tijdzone).getTime() > Date.now() + 24 * 3600000;
}

export async function laadGastReservatie(token: string) {
  if (!z.string().uuid().safeParse(token).success) return null;
  const db = createServiceRoleClient();
  const { data, error } = await db.from("reservations").select("*").eq("cancel_token", token).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [restaurant, settings] = await Promise.all([
    db.from("restaurants").select("id, slug, naam, tijdzone, status, email, telefoon").eq("id", data.restaurant_id).single(),
    db.from("settings").select("max_groepsgrootte, standaard_duur_minuten, widget_primaire_kleur").eq("restaurant_id", data.restaurant_id).single(),
  ]);
  if (restaurant.error) throw restaurant.error;
  if (settings.error) throw settings.error;
  return { reservatie: data, restaurant: restaurant.data, settings: settings.data };
}
