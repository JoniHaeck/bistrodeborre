import { formatDatum } from "@/lib/format";

export type MailReservatie = {
  voornaam: string;
  naam: string;
  email: string;
  telefoon: string | null;
  opmerking: string | null;
  datum: string;
  tijdslot: string;
  aantal_personen: number;
  menu: boolean;
  cancel_token: string;
};

export type MailContext = { restaurantNaam: string; siteUrl: string; kleur?: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const uur = (t: string) => t.slice(0, 5);
const annuleerLink = (r: MailReservatie, c: MailContext) =>
  `${c.siteUrl}/reserveren/annuleren/${r.cancel_token}`;

function rij(label: string, waarde: string) {
  return `<tr><td style="padding:4px 16px 4px 0;color:#666">${label}</td><td style="padding:4px 0"><strong>${esc(waarde)}</strong></td></tr>`;
}

function details(r: MailReservatie, metContact = false) {
  return `<table style="border-collapse:collapse;margin:16px 0">
${rij("Datum", formatDatum(r.datum, true))}
${rij("Uur", uur(r.tijdslot))}
${rij("Aantal personen", String(r.aantal_personen))}
${rij("Menu", r.menu ? "Ja, de hele tafel neemt het menu" : "Nee")}
${metContact ? rij("Naam", `${r.voornaam} ${r.naam}`) + rij("E-mail", r.email) + rij("Telefoon", r.telefoon ?? "-") : ""}
${r.opmerking ? rij("Opmerking", r.opmerking) : ""}
</table>`;
}

function layout(c: MailContext, inhoud: string) {
  return `<!doctype html><html lang="nl"><body style="margin:0;background:#f5f5f5;font-family:system-ui,Arial,sans-serif;color:#171717">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#fff;border-radius:8px;padding:24px;border-top:4px solid ${c.kleur ?? "#7a1f2b"}">
<h1 style="font-size:20px;margin:0 0 16px">${esc(c.restaurantNaam)}</h1>
${inhoud}
</div></div></body></html>`;
}

function annuleerBlok(r: MailReservatie, c: MailContext) {
  const url = annuleerLink(r, c);
  return `<p>Kunt u toch niet komen? <a href="${url}">Annuleer uw reservatie</a> zodat een ander uw plaats kan nemen.</p>`;
}

export function bevestigingMail(r: MailReservatie, c: MailContext) {
  return {
    subject: `Bevestiging van uw reservatie op ${formatDatum(r.datum)} om ${uur(r.tijdslot)}`,
    html: layout(
      c,
      `<p>Beste ${esc(r.voornaam)},</p><p>Bedankt voor uw reservatie. We verwachten u graag!</p>${details(r)}${annuleerBlok(r, c)}`,
    ),
    text: `Beste ${r.voornaam},\n\nUw reservatie is bevestigd.\n${formatDatum(r.datum, true)} om ${uur(r.tijdslot)}\n${r.aantal_personen} personen, menu: ${r.menu ? "ja" : "nee"}\n\nAnnuleren: ${annuleerLink(r, c)}\n\n${c.restaurantNaam}`,
  };
}

export function herinneringMail(r: MailReservatie, c: MailContext) {
  return {
    subject: `Herinnering: uw reservatie op ${formatDatum(r.datum)} om ${uur(r.tijdslot)}`,
    html: layout(
      c,
      `<p>Beste ${esc(r.voornaam)},</p><p>Een vriendelijke herinnering aan uw reservatie:</p>${details(r)}${annuleerBlok(r, c)}`,
    ),
    text: `Beste ${r.voornaam},\n\nHerinnering aan uw reservatie.\n${formatDatum(r.datum, true)} om ${uur(r.tijdslot)}\n${r.aantal_personen} personen, menu: ${r.menu ? "ja" : "nee"}\n\nAnnuleren: ${annuleerLink(r, c)}\n\n${c.restaurantNaam}`,
  };
}

export function restaurantMelding(r: MailReservatie, c: MailContext) {
  return {
    subject: `Nieuwe reservatie: ${r.voornaam} ${r.naam}, ${r.aantal_personen} p. op ${formatDatum(r.datum)} ${uur(r.tijdslot)}${r.menu ? " (menu)" : ""}`,
    html: layout(c, `<p>Er is een nieuwe reservatie binnengekomen.</p>${details(r, true)}`),
    text: `Nieuwe reservatie\n${formatDatum(r.datum, true)} om ${uur(r.tijdslot)}\n${r.aantal_personen} personen, menu: ${r.menu ? "ja" : "nee"}\n${r.voornaam} ${r.naam} / ${r.email} / ${r.telefoon ?? "-"}\n${r.opmerking ?? ""}`,
  };
}
