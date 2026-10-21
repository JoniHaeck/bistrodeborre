import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";

/** De vaste tijdzone van Bistro de Borre: alle datums/uren worden in deze zone geïnterpreteerd. */
export const RESTAURANT_TIJDZONE = "Europe/Brussels";

/** Huidige datum/tijd als Date-object, geïnterpreteerd in Europe/Brussels. */
export function nuInBrussel(): Date {
  return toZonedTime(new Date(), RESTAURANT_TIJDZONE);
}

/** Huidige kalenderdatum (YYYY-MM-DD) in Europe/Brussels. */
export function vandaagInBrussel(): string {
  return formatInTimeZone(new Date(), RESTAURANT_TIJDZONE, "yyyy-MM-dd");
}

/**
 * Zet een datum (YYYY-MM-DD) + tijdslot (HH:mm) om naar een absoluut (UTC) Date-object,
 * rekening houdend met de Brusselse zomer-/wintertijd. Hiermee kunnen reservatie-
 * tijdstippen betrouwbaar vergeleken worden met "nu".
 */
export function datumTijdslotNaarUtc(datum: string, tijdslot: string): Date {
  return fromZonedTime(`${datum}T${tijdslot}:00`, RESTAURANT_TIJDZONE);
}

/** True als het gegeven datum + tijdslot in het verleden ligt (Europe/Brussels). */
export function isInVerleden(datum: string, tijdslot: string): boolean {
  return datumTijdslotNaarUtc(datum, tijdslot).getTime() < Date.now();
}
