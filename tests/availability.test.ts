import { describe, expect, it } from "vitest";
import {
  genereerTijdsloten,
  getBeschikbareDagen,
  getBeschikbareSlots,
  getSlotsVoorDatum,
  valideerReservatie,
  weekdagVan,
  type AvailabilityContext,
  type Shift,
  type Uitzondering,
} from "@/lib/availability";

// Woensdag 21 oktober 2026, 10:00 Brussel (08:00 UTC, zomertijd t/m 25 okt)
const NU = new Date("2026-10-21T08:00:00Z");
const DATUM = "2026-10-23"; // vrijdag

const shift = (over: Partial<Shift> & Pick<Shift, "id" | "naam" | "start_tijd" | "eind_tijd">): Shift => ({
  weekdag: 5,
  actief: true,
  capaciteit_per_slot: null,
  ...over,
});

const MIDDAG = shift({ id: "m", naam: "Middag", start_tijd: "12:00:00", eind_tijd: "14:00:00" });
const AVOND = shift({ id: "a", naam: "Avond", start_tijd: "18:00:00", eind_tijd: "20:00:00" });

const uitz = (over: Partial<Uitzondering>): Uitzondering => ({
  datum: DATUM,
  gesloten: false,
  shift_template_id: null,
  geblokkeerd: false,
  geblokkeerde_tijdsloten: null,
  afwijkende_capaciteit: null,
  ...over,
});

function ctx(over: Partial<AvailabilityContext> = {}): AvailabilityContext {
  return {
    instellingen: {
      slot_minuten: 15,
      standaard_capaciteit: 8,
      max_groepsgrootte: 10,
      boekingshorizon_dagen: 60,
      min_voorboekingsuren: 2,
    },
    shiften: [MIDDAG, AVOND],
    uitzonderingen: [],
    bezetting: {},
    nu: NU,
    ...over,
  };
}

describe("genereerTijdsloten", () => {
  it("geeft kwartierslots inclusief het einduur", () => {
    expect(genereerTijdsloten("12:00:00", "14:00:00", 15)).toEqual([
      "12:00", "12:15", "12:30", "12:45", "13:00", "13:15", "13:30", "13:45", "14:00",
    ]);
  });
});

describe("weekdagVan", () => {
  it("geeft 5 voor vrijdag en 0 voor zondag", () => {
    expect(weekdagVan("2026-10-23")).toBe(5);
    expect(weekdagVan("2026-10-25")).toBe(0);
  });
});

describe("getSlotsVoorDatum", () => {
  it("geeft 18 slots voor middag + avond met standaardcapaciteit", () => {
    const slots = getSlotsVoorDatum(DATUM, ctx());
    expect(slots).toHaveLength(18);
    expect(slots.every((s) => s.capaciteit === 8 && s.vrij === 8)).toBe(true);
  });

  it("geeft niets op een weekdag zonder actieve shift", () => {
    expect(getSlotsVoorDatum("2026-10-24", ctx())).toEqual([]);
    expect(getSlotsVoorDatum(DATUM, ctx({ shiften: [{ ...MIDDAG, actief: false }] }))).toEqual([]);
  });

  it("telt bestaande personen mee", () => {
    const slots = getSlotsVoorDatum(DATUM, ctx({ bezetting: { [`${DATUM}|12:00`]: 6 } }));
    const s = slots.find((x) => x.tijdslot === "12:00")!;
    expect(s.bezet).toBe(6);
    expect(s.vrij).toBe(2);
  });

  it("gebruikt shiftcapaciteit boven de standaard, en datumafwijking boven beide", () => {
    const m = { ...MIDDAG, capaciteit_per_slot: 6 };
    expect(getSlotsVoorDatum(DATUM, ctx({ shiften: [m] }))[0].capaciteit).toBe(6);
    const c = ctx({ shiften: [m], uitzonderingen: [uitz({ afwijkende_capaciteit: 4 })] });
    expect(getSlotsVoorDatum(DATUM, c)[0].capaciteit).toBe(4);
  });

  it("markeert een gesloten dag, en een gesloten shift enkel voor die shift", () => {
    const dag = getSlotsVoorDatum(DATUM, ctx({ uitzonderingen: [uitz({ gesloten: true })] }));
    expect(dag.every((s) => s.gesloten === "gesloten")).toBe(true);

    const shiftOnly = getSlotsVoorDatum(
      DATUM,
      ctx({ uitzonderingen: [uitz({ gesloten: true, shift_template_id: "m" })] }),
    );
    expect(shiftOnly.filter((s) => s.shiftId === "m").every((s) => s.gesloten)).toBe(true);
    expect(shiftOnly.filter((s) => s.shiftId === "a").every((s) => !s.gesloten)).toBe(true);
  });

  it("blokkeert een hele shift of losse slots", () => {
    const c = ctx({
      uitzonderingen: [
        uitz({ geblokkeerd: true, shift_template_id: "a" }),
        uitz({ geblokkeerde_tijdsloten: ["12:15:00"], shift_template_id: "m" }),
      ],
    });
    const slots = getSlotsVoorDatum(DATUM, c);
    expect(slots.filter((s) => s.shiftId === "a").every((s) => s.gesloten === "geblokkeerd")).toBe(true);
    expect(slots.find((s) => s.tijdslot === "12:15")!.gesloten).toBe("geblokkeerd");
    expect(slots.find((s) => s.tijdslot === "12:30")!.gesloten).toBeUndefined();
  });

  it("sluit verleden, te korte termijn en buiten de horizon uit", () => {
    // Vandaag (woensdag) 10:00 Brussel, minimaal 2u op voorhand
    const woensdag = [{ ...MIDDAG, weekdag: 3, start_tijd: "09:00", eind_tijd: "13:00" }];
    const slots = getSlotsVoorDatum("2026-10-21", ctx({ shiften: woensdag }));
    expect(slots.find((s) => s.tijdslot === "09:30")!.gesloten).toBe("verleden");
    expect(slots.find((s) => s.tijdslot === "11:00")!.gesloten).toBe("te_kort_dag");
    expect(slots.find((s) => s.tijdslot === "12:00")!.gesloten).toBeUndefined();

    const ver = getSlotsVoorDatum("2026-12-25", ctx({ shiften: [{ ...MIDDAG, weekdag: 5 }] }));
    expect(ver.every((s) => s.gesloten === "buiten_horizon")).toBe(true);
  });
});

describe("getBeschikbareSlots / getBeschikbareDagen", () => {
  it("filtert slots waar de groep niet meer past (bestaand + nieuw > capaciteit)", () => {
    const c = ctx({ bezetting: { [`${DATUM}|12:00`]: 6 } });
    const vier = getBeschikbareSlots(DATUM, 4, c).map((s) => s.tijdslot);
    expect(vier).not.toContain("12:00");
    expect(getBeschikbareSlots(DATUM, 2, c).map((s) => s.tijdslot)).toContain("12:00");
  });

  it("toont alleen dagen met beschikbare slots", () => {
    const dagen = getBeschikbareDagen(2, ctx({ uitzonderingen: [uitz({ gesloten: true })] }));
    expect(dagen).not.toContain(DATUM);
    expect(dagen).toContain("2026-10-30");
    expect(dagen).not.toContain("2026-10-24"); // zaterdag: geen shift
    expect(dagen.every((d) => d <= "2026-12-20")).toBe(true);
  });

  it("laat een dag weg als alle slots volzet zijn voor de groep", () => {
    const bezetting: Record<string, number> = {};
    for (const s of getSlotsVoorDatum(DATUM, ctx())) bezetting[`${DATUM}|${s.tijdslot}`] = 8;
    expect(getBeschikbareDagen(1, ctx({ bezetting }))).not.toContain(DATUM);
  });
});

describe("valideerReservatie", () => {
  const basis = { datum: DATUM, tijdslot: "12:00", aantal: 2 };

  it("accepteert een geldige aanvraag", () => {
    const r = valideerReservatie(basis, ctx());
    expect(r.ok).toBe(true);
  });

  it("weigert ongeldige of te grote groepen", () => {
    expect(valideerReservatie({ ...basis, aantal: 0 }, ctx())).toMatchObject({ code: "ongeldige_groep" });
    expect(valideerReservatie({ ...basis, aantal: 1.5 }, ctx())).toMatchObject({ code: "ongeldige_groep" });
    expect(valideerReservatie({ ...basis, aantal: 11 }, ctx())).toMatchObject({ code: "groep_te_groot" });
  });

  it("weigert een onbestaand tijdstip", () => {
    expect(valideerReservatie({ ...basis, tijdslot: "15:00" }, ctx())).toMatchObject({ code: "geen_slot" });
    expect(valideerReservatie({ ...basis, tijdslot: "12:10" }, ctx())).toMatchObject({ code: "geen_slot" });
  });

  it("weigert gesloten, geblokkeerde en voorbije slots", () => {
    const gesloten = ctx({ uitzonderingen: [uitz({ gesloten: true })] });
    expect(valideerReservatie(basis, gesloten)).toMatchObject({ code: "niet_beschikbaar" });
    expect(valideerReservatie({ ...basis, datum: "2026-10-16" }, ctx())).toMatchObject({
      code: "niet_beschikbaar",
    });
  });

  it("weigert wanneer bestaande personen + nieuwe groep > capaciteit, maar laat exacte capaciteit toe", () => {
    const c = ctx({ bezetting: { [`${DATUM}|12:00`]: 6 } });
    expect(valideerReservatie({ ...basis, aantal: 3 }, c)).toMatchObject({ code: "volzet" });
    expect(valideerReservatie({ ...basis, aantal: 2 }, c).ok).toBe(true);
  });
});
