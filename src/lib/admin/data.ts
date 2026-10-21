import { createServiceRoleClient } from "@/lib/supabase/service";
import { normaliseerTijd, slotSleutel, type AvailabilityContext } from "@/lib/availability";

export const STATUSSEN = ["bevestigd", "aangekomen", "no_show", "geannuleerd"] as const;
export type Status = (typeof STATUSSEN)[number];

export const STATUS_LABEL: Record<Status, string> = {
  bevestigd: "Bevestigd",
  aangekomen: "Aangekomen",
  no_show: "No-show",
  geannuleerd: "Geannuleerd",
};

export const WEEKDAGEN = [
  { nr: 1, naam: "Maandag" },
  { nr: 2, naam: "Dinsdag" },
  { nr: 3, naam: "Woensdag" },
  { nr: 4, naam: "Donderdag" },
  { nr: 5, naam: "Vrijdag" },
  { nr: 6, naam: "Zaterdag" },
  { nr: 0, naam: "Zondag" },
];

export const LOG_LABEL: Record<string, string> = {
  aangemaakt: "Aangemaakt",
  gewijzigd: "Gewijzigd",
  geannuleerd: "Geannuleerd",
  mail_bevestiging: "Bevestigingsmail verstuurd",
  mail_melding: "Melding naar restaurant verstuurd",
  mail_herinnering: "Herinneringsmail verstuurd",
  mail_bevestiging_mislukt: "Bevestigingsmail mislukt",
  mail_melding_mislukt: "Melding naar restaurant mislukt",
  mail_herinnering_mislukt: "Herinneringsmail mislukt",
};

/**
 * Context voor één datum waarin enkel sluitingen/blokkades meetellen: beheerders mogen ook
 * in het verleden of buiten de boekingshorizon werken. Daarom een "nu" in 1970 en een ruime horizon.
 */
export async function laadDagContext(datum: string): Promise<AvailabilityContext> {
  const db = createServiceRoleClient();
  const [instellingen, shiften, uitzonderingen, bezet] = await Promise.all([
    db
      .from("settings")
      .select("slot_minuten, standaard_capaciteit, max_groepsgrootte")
      .eq("id", 1)
      .single(),
    db.from("shift_templates").select("*").eq("actief", true),
    db.from("date_exceptions").select("*").eq("datum", datum),
    db.rpc("get_bezetting", { p_van: datum, p_tot: datum }),
  ]);
  if (instellingen.error) throw instellingen.error;
  if (shiften.error) throw shiften.error;
  if (uitzonderingen.error) throw uitzonderingen.error;
  if (bezet.error) throw bezet.error;

  const bezetting: AvailabilityContext["bezetting"] = {};
  for (const rij of bezet.data) {
    bezetting[slotSleutel(rij.datum, normaliseerTijd(rij.tijdslot))] = Number(rij.aantal_bezet);
  }
  return {
    instellingen: { ...instellingen.data, boekingshorizon_dagen: 100_000, min_voorboekingsuren: 0 },
    shiften: shiften.data,
    uitzonderingen: uitzonderingen.data,
    bezetting,
    nu: new Date(0),
  };
}
