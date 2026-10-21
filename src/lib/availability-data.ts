import { createServiceRoleClient } from "@/lib/supabase/service";
import { normaliseerTijd, slotSleutel, voegDagenToe, type AvailabilityContext } from "@/lib/availability";
import { vandaagInBrussel } from "@/lib/time";

/** Laadt alles wat de beschikbaarheidslogica nodig heeft. Enkel server-side gebruiken. */
export async function laadAvailabilityContext(): Promise<AvailabilityContext> {
  const supabase = createServiceRoleClient();
  const nu = new Date();
  const vandaag = vandaagInBrussel(nu);

  const { data: instellingen, error: instErr } = await supabase
    .from("settings")
    .select("slot_minuten, standaard_capaciteit, max_groepsgrootte, boekingshorizon_dagen, min_voorboekingsuren")
    .eq("id", 1)
    .single();
  if (instErr) throw instErr;

  const tot = voegDagenToe(vandaag, instellingen.boekingshorizon_dagen);

  const [shiften, uitzonderingen, bezet] = await Promise.all([
    supabase.from("shift_templates").select("*").eq("actief", true),
    supabase.from("date_exceptions").select("*").gte("datum", vandaag).lte("datum", tot),
    supabase.rpc("get_bezetting", { p_van: vandaag, p_tot: tot }),
  ]);
  if (shiften.error) throw shiften.error;
  if (uitzonderingen.error) throw uitzonderingen.error;
  if (bezet.error) throw bezet.error;

  const bezetting: AvailabilityContext["bezetting"] = {};
  for (const rij of bezet.data) {
    bezetting[slotSleutel(rij.datum, normaliseerTijd(rij.tijdslot))] = Number(rij.aantal_bezet);
  }

  return {
    instellingen,
    shiften: shiften.data,
    uitzonderingen: uitzonderingen.data,
    bezetting,
    nu,
  };
}
