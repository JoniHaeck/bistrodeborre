import { datumTijdslotNaarUtc } from "@/lib/time";

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const icsTijd = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

function vouw(regel: string) {
  const encoder = new TextEncoder();
  const delen: string[] = [];
  let deel = "";
  let bytes = 0;
  for (const teken of regel) {
    const lengte = encoder.encode(teken).length;
    if (bytes + lengte > 75) {
      delen.push(deel);
      deel = " ";
      bytes = 1;
    }
    deel += teken;
    bytes += lengte;
  }
  delen.push(deel);
  return delen.join("\r\n");
}

export function maakAgenda(r: {
  id: string; datum: string; tijdslot: string; aantal_personen: number; menu: boolean;
}, restaurant: string, tijdzone: string, duur: number, nu = new Date()) {
  const start = datumTijdslotNaarUtc(r.datum, r.tijdslot.slice(0, 5), tijdzone);
  const einde = new Date(start.getTime() + duur * 60000);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tafelvrij//Reservatie//NL", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${r.id}@tafelvrij`, `DTSTAMP:${icsTijd(nu)}`,
    `DTSTART:${icsTijd(start)}`, `DTEND:${icsTijd(einde)}`,
    `SUMMARY:${escape(`Reservatie ${restaurant}`)}`,
    `DESCRIPTION:${escape(`${r.aantal_personen} personen, menu: ${r.menu ? "ja" : "nee"}`)}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].map(vouw).join("\r\n");
}
