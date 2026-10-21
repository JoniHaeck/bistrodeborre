import { createServiceRoleClient } from "@/lib/supabase/service";
import { datumTijdslotNaarUtc, vandaagInBrussel } from "@/lib/time";
import { laadMailInstellingen, stuurHerinnering } from "./send";

const UUR = 3_600_000;

/**
 * Verstuurt herinneringen voor bevestigde reservaties die binnen het ingestelde aantal uren beginnen.
 * Elke reservatie wordt eerst atomair "geclaimd" via reminder_sent_at, zodat gelijktijdige runs nooit dubbel versturen.
 */
export async function verwerkHerinneringen(nu: Date = new Date()) {
  const { ctx, herinneringenActief, herinneringUren } = await laadMailInstellingen();
  if (!herinneringenActief) return { actief: false, verstuurd: 0, mislukt: 0 };

  const supabase = createServiceRoleClient();
  const tot = new Date(nu.getTime() + (herinneringUren + 24) * UUR);
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
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
  return { actief: true, verstuurd, mislukt };
}
