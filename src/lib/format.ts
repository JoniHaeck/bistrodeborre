/** "2026-10-23" -> "vrijdag 23 oktober" (tijdzone-onafhankelijk). */
export function formatDatum(datum: string, metJaar = false): string {
  const [j, m, d] = datum.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(metJaar ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(j, m - 1, d)));
}

/** ISO-tijdstip -> "21/10/2026, 18:30" in Europe/Brussels. */
export function formatTijdstip(iso: string): string {
  return new Intl.DateTimeFormat("nl-BE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Brussels",
  }).format(new Date(iso));
}
