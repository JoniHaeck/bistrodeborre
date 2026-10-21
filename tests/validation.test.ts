import { describe, expect, it } from "vitest";
import { reservatieSchema } from "@/lib/validation";

const geldig = {
  datum: "2026-10-23",
  tijdslot: "12:00",
  aantal: 2,
  voornaam: "Jan",
  naam: "Peeters",
  email: "Jan@Example.com ",
  telefoon: "+32 470 12 34 56",
  menu: true,
};

describe("reservatieSchema", () => {
  it("accepteert een geldige aanvraag en normaliseert e-mail", () => {
    const r = reservatieSchema.parse(geldig);
    expect(r.email).toBe("jan@example.com");
    expect(r.opmerking).toBeNull();
  });

  it.each([
    ["email", "geen-email"],
    ["telefoon", "abc"],
    ["voornaam", "   "],
    ["aantal", 0],
    ["datum", "23/10/2026"],
    ["tijdslot", "12u"],
    ["opmerking", "x".repeat(501)],
  ])("weigert ongeldig veld %s", (veld, waarde) => {
    expect(reservatieSchema.safeParse({ ...geldig, [veld]: waarde }).success).toBe(false);
  });

  it("laat het honeypot-veld door zodat de route het stil kan negeren", () => {
    expect(reservatieSchema.parse({ ...geldig, website: "http://spam" }).website).toBe("http://spam");
  });
});
