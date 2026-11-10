import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

/**
 * Elk restaurant heeft een eigen tijdzone (`restaurants.tijdzone`). Datums (YYYY-MM-DD) en
 * tijdsloten (HH:mm) in de database zijn lokale tijd van het restaurant; geef daarom overal
 * de tijdzone van het restaurant mee.
 */
export const STANDAARD_TIJDZONE = "Europe/Brussels";

/** Tijdzones die een restaurant kan kiezen (de rest van de app werkt met elke IANA-zone). */
export const TIJDZONES = [
  "Europe/Brussels",
  "Europe/Amsterdam",
  "Europe/Luxembourg",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Rome",
  "Atlantic/Canary",
] as const;

/** Is dit een tijdzone die de runtime kent (bv. "Europe/Brussels")? */
export function isGeldigeTijdzone(tijdzone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tijdzone });
    return true;
  } catch {
    return false;
  }
}

/** Huidige kalenderdatum (YYYY-MM-DD) in de tijdzone van het restaurant. */
export function vandaagIn(tijdzone: string, nu: Date = new Date()): string {
  return formatInTimeZone(nu, tijdzone, "yyyy-MM-dd");
}

/**
 * Zet een datum (YYYY-MM-DD) + tijdslot (HH:mm) in de tijdzone van het restaurant om naar een
 * absoluut (UTC) Date-object, rekening houdend met zomer-/wintertijd. Hiermee kunnen
 * reservatietijdstippen betrouwbaar vergeleken worden met "nu".
 */
export function datumTijdslotNaarUtc(datum: string, tijdslot: string, tijdzone: string): Date {
  return fromZonedTime(`${datum}T${tijdslot}:00`, tijdzone);
}

/** True als het gegeven datum + tijdslot (lokale tijd van het restaurant) in het verleden ligt. */
export function isInVerleden(datum: string, tijdslot: string, tijdzone: string, nu: Date = new Date()): boolean {
  return datumTijdslotNaarUtc(datum, tijdslot, tijdzone).getTime() < nu.getTime();
}
