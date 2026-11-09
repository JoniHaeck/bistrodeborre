import { createServiceRoleClient } from "@/lib/supabase/service";
import { datumTijdslotNaarUtc, vandaagInBrussel } from "@/lib/time";
import { laadMailInstellingen, stuurHerinnering } from "./send";

const UUR = 3_600_000;

type Resultaat = { verstuurd: number; mislukt: number };

/**
 * Verstuurt herinneringen voor alle restaurants met herinneringen aan. Een fout bij één restaurant
 * stopt de andere niet.
 */
export async function verwerkHerinneringen(nu: Date = new Date()) {
  const { data: restaurants, error } = await createServiceRoleClient()
    .from("settings")
    .select("restaurant_id")
    .eq("herinneringen_actief", true);
  if (error) throw error;

  const totaal: Resultaat & { restaurants: number; fouten: number } = { verstuurd: 0, mislukt: 0, restaurants: 0, fouten: 0 };
  for (const { restaurant_id } of restaurants ?? []) {
    try {
      const r = await verwerkHerinneringenVoorRestaurant(restaurant_id, nu);
      totaal.verstuurd += r.verstuurd;
      totaal.mislukt += r.mislukt;
      totaal.restaurants++;
    } catch (e) {
      totaal.fouten++;
      console.error(`Herinneringen mislukt voor restaurant ${restaurant_id}`, e);
    }
  }
  return totaal;
}

/**
 * Verstuurt herinneringen voor bevestigde reservaties van één restaurant die binnen het ingestelde
 * aantal uren beginnen. Elke reservatie wordt eerst atomair "geclaimd" via reminder_sent_at, zodat
 * gelijktijdige runs nooit dubbel versturen.
 */
export async function verwerkHerinneringenVoorRestaurant(restaurantId: string, nu: Date = new Date()): Promise<Resultaat> {
  const { ctx, herinneringenActief, herinneringUren } = await laadMailInstellingen(restaurantId);
  if (!herinneringenActief) return { verstuurd: 0, mislukt: 0 };

  const supabase = createServiceRoleClient();
  const tot = new Date(nu.getTime() + (herinneringUren + 24) * UUR);
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("status", "bevestigd")
    .is("reminder_sent_at", null)
    .gte("datum", vandaagInBrussel(nu))
    .lte("datum", vandaagInBrussel(tot));
  if (error) throw error;

  let verstuurd = 0;
  let mislukt = 0;
  for (const r of data ?? []) {
    const start = datumTijdslotNaarUtc(r.datum, r.tijdslot.slice(0, 5)).getTime();
    const venster = start - herinneringUren * UUR;
    const geboektBinnenVenster = new Date(r.created_at).getTime() >= venster;
    if (start <= nu.getTime() || venster > nu.getTime() || geboektBinnenVenster) continue;

    const { data: geclaimd } = await supabase
      .from("reservations")
      .update({ reminder_sent_at: nu.toISOString() })
      .eq("id", r.id)
      .is("reminder_sent_at", null)
      .select("id");
    if (!geclaimd?.length) continue;

    if (await stuurHerinnering(r, ctx)) {
      verstuurd++;
    } else {
      mislukt++;
      await supabase.from("reservations").update({ reminder_sent_at: null }).eq("id", r.id);
    }
  }
  return { verstuurd, mislukt };
}
