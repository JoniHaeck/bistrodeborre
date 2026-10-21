import { datumTijdslotNaarUtc, vandaagInBrussel } from "@/lib/time";

export type Instellingen = {
  slot_minuten: number;
  standaard_capaciteit: number;
  max_groepsgrootte: number;
  boekingshorizon_dagen: number;
  min_voorboekingsuren: number;
};

export type Shift = {
  id: string;
  weekdag: number;
  naam: string;
  start_tijd: string;
  eind_tijd: string;
  actief: boolean;
  capaciteit_per_slot: number | null;
};

export type Uitzondering = {
  datum: string;
  gesloten: boolean;
  shift_template_id: string | null;
  geblokkeerd: boolean;
  geblokkeerde_tijdsloten: string[] | null;
  afwijkende_capaciteit: number | null;
};

/** Bezette personen per `${datum}|${HH:mm}`. */
export type Bezetting = Record<string, number>;

export type AvailabilityContext = {
  instellingen: Instellingen;
  shiften: Shift[];
  uitzonderingen: Uitzondering[];
  bezetting: Bezetting;
  nu: Date;
};

export type Slot = {
  datum: string;
  tijdslot: string;
  shiftId: string;
  shiftNaam: string;
  capaciteit: number;
  bezet: number;
  vrij: number;
  /** Reden waarom het slot niet boekbaar is, ongeacht groepsgrootte. */
  gesloten?: "gesloten" | "geblokkeerd" | "verleden" | "buiten_horizon" | "te_kort_dag";
};

export type ValidatieFout =
  | "ongeldige_groep"
  | "groep_te_groot"
  | "geen_slot"
  | "niet_beschikbaar"
  | "volzet";

export type ValidatieResultaat =
  | { ok: true; slot: Slot }
  | { ok: false; code: ValidatieFout; bericht: string };

export const slotSleutel = (datum: string, tijdslot: string) => `${datum}|${tijdslot}`;

/** "12:00:00" -> "12:00" */
export function normaliseerTijd(tijd: string): string {
  return tijd.slice(0, 5);
}

function naarMinuten(tijd: string): number {
  const [u, m] = normaliseerTijd(tijd).split(":").map(Number);
  return u * 60 + m;
}

function naarTijd(minuten: number): string {
  const u = Math.floor(minuten / 60);
  const m = minuten % 60;
  return `${String(u).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Weekdag (0 = zondag ... 6 = zaterdag) van een YYYY-MM-DD datum, tijdzone-onafhankelijk. */
export function weekdagVan(datum: string): number {
  const [j, m, d] = datum.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, d)).getUTCDay();
}

export function voegDagenToe(datum: string, dagen: number): string {
  const [j, m, d] = datum.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, d + dagen)).toISOString().slice(0, 10);
}

/**
 * Kwartierslots van een shift. Het einduur is het laatste boekbare slot (inclusief):
 * 12:00–14:00 geeft 12:00, 12:15, ..., 14:00.
 */
export function genereerTijdsloten(start: string, einde: string, slotMinuten: number): string[] {
  const resultaat: string[] = [];
  for (let t = naarMinuten(start); t <= naarMinuten(einde); t += slotMinuten) {
    resultaat.push(naarTijd(t));
  }
  return resultaat;
}

function geldtVoorShift(u: Uitzondering, shiftId: string): boolean {
  return u.shift_template_id === null || u.shift_template_id === shiftId;
}

/** Alle slots van een datum met capaciteit, bezetting en eventuele sluitingsreden. */
export function getSlotsVoorDatum(datum: string, ctx: AvailabilityContext): Slot[] {
  const { instellingen, shiften, uitzonderingen, bezetting, nu } = ctx;
  const vandaag = vandaagInBrussel(nu);
  const laatsteDag = voegDagenToe(vandaag, instellingen.boekingshorizon_dagen);
  const dagUitzonderingen = uitzonderingen.filter((u) => u.datum === datum);
  const weekdag = weekdagVan(datum);
  const minimum = nu.getTime() + instellingen.min_voorboekingsuren * 3_600_000;

  const slots: Slot[] = [];
  const dagShiften = shiften
    .filter((s) => s.actief && s.weekdag === weekdag)
    .sort((a, b) => naarMinuten(a.start_tijd) - naarMinuten(b.start_tijd));

  for (const shift of dagShiften) {
    const relevant = dagUitzonderingen.filter((u) => geldtVoorShift(u, shift.id));
    const gesloten = relevant.some((u) => u.gesloten);
    const shiftGeblokkeerd = relevant.some((u) => u.geblokkeerd);
    const geblokkeerdeSloten = new Set(
      relevant.flatMap((u) => (u.geblokkeerde_tijdsloten ?? []).map(normaliseerTijd)),
    );
    // Een afwijking specifiek voor deze shift wint van een dagbrede afwijking.
    const afwijking =
      relevant.find((u) => u.shift_template_id === shift.id && u.afwijkende_capaciteit !== null) ??
      relevant.find((u) => u.afwijkende_capaciteit !== null);
    const capaciteit =
      afwijking?.afwijkende_capaciteit ??
      shift.capaciteit_per_slot ??
      instellingen.standaard_capaciteit;

    for (const tijdslot of genereerTijdsloten(
      shift.start_tijd,
      shift.eind_tijd,
      instellingen.slot_minuten,
    )) {
      const bezet = bezetting[slotSleutel(datum, tijdslot)] ?? 0;
      let reden: Slot["gesloten"];
      if (gesloten) reden = "gesloten";
      else if (shiftGeblokkeerd || geblokkeerdeSloten.has(tijdslot)) reden = "geblokkeerd";
      else if (datum > laatsteDag) reden = "buiten_horizon";
      else if (datumTijdslotNaarUtc(datum, tijdslot).getTime() < nu.getTime()) reden = "verleden";
      else if (datumTijdslotNaarUtc(datum, tijdslot).getTime() < minimum) reden = "te_kort_dag";

      slots.push({
        datum,
        tijdslot,
        shiftId: shift.id,
        shiftNaam: shift.naam,
        capaciteit,
        bezet,
        vrij: Math.max(0, capaciteit - bezet),
        ...(reden ? { gesloten: reden } : {}),
      });
    }
  }
  return slots;
}

/** Slots waarop een groep van `aantal` personen nog past (bestaand + nieuw <= capaciteit). */
export function getBeschikbareSlots(
  datum: string,
  aantal: number,
  ctx: AvailabilityContext,
): Slot[] {
  return getSlotsVoorDatum(datum, ctx).filter((s) => !s.gesloten && s.vrij >= aantal);
}

/** Datums (vanaf vandaag tot de boekingshorizon) met minstens één beschikbaar slot voor de groep. */
export function getBeschikbareDagen(aantal: number, ctx: AvailabilityContext): string[] {
  const vandaag = vandaagInBrussel(ctx.nu);
  const dagen: string[] = [];
  for (let i = 0; i <= ctx.instellingen.boekingshorizon_dagen; i++) {
    const datum = voegDagenToe(vandaag, i);
    if (getBeschikbareSlots(datum, aantal, ctx).length > 0) dagen.push(datum);
  }
  return dagen;
}

/** Server-side controle van een boekingsaanvraag. */
export function valideerReservatie(
  input: { datum: string; tijdslot: string; aantal: number },
  ctx: AvailabilityContext,
): ValidatieResultaat {
  const { aantal } = input;
  if (!Number.isInteger(aantal) || aantal < 1) {
    return { ok: false, code: "ongeldige_groep", bericht: "Ongeldig aantal personen." };
  }
  if (aantal > ctx.instellingen.max_groepsgrootte) {
    return {
      ok: false,
      code: "groep_te_groot",
      bericht: `Voor groepen groter dan ${ctx.instellingen.max_groepsgrootte} personen contacteert u ons best rechtstreeks.`,
    };
  }

  const slot = getSlotsVoorDatum(input.datum, ctx).find((s) => s.tijdslot === input.tijdslot);
  if (!slot) {
    return { ok: false, code: "geen_slot", bericht: "Dit tijdstip bestaat niet." };
  }
  if (slot.gesloten) {
    return { ok: false, code: "niet_beschikbaar", bericht: "Dit tijdstip is niet beschikbaar." };
  }
  if (slot.vrij < aantal) {
    return { ok: false, code: "volzet", bericht: "Dit tijdstip is helaas volzet." };
  }
  return { ok: true, slot };
}
