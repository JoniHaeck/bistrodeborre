import { describe, expect, it } from "vitest";
import { datumTijdslotNaarUtc, isGeldigeTijdzone, isInVerleden, vandaagIn } from "@/lib/time";

const BRUSSEL = "Europe/Brussels";

describe("time helpers", () => {
  it("zet een wintertijd-datum in Brussel correct om naar UTC (UTC+1)", () => {
    expect(datumTijdslotNaarUtc("2026-01-15", "12:00", BRUSSEL).toISOString()).toBe("2026-01-15T11:00:00.000Z");
  });

  it("zet een zomertijd-datum in Brussel correct om naar UTC (UTC+2)", () => {
    expect(datumTijdslotNaarUtc("2026-07-15", "12:00", BRUSSEL).toISOString()).toBe("2026-07-15T10:00:00.000Z");
  });

  it("gebruikt de tijdzone van het restaurant", () => {
    expect(datumTijdslotNaarUtc("2026-07-15", "12:00", "Europe/London").toISOString()).toBe("2026-07-15T11:00:00.000Z");
    expect(datumTijdslotNaarUtc("2026-01-15", "12:00", "Europe/Lisbon").toISOString()).toBe("2026-01-15T12:00:00.000Z");
  });

  it("geeft de kalenderdatum in de tijdzone van het restaurant", () => {
    const nu = new Date("2026-10-21T22:30:00Z");
    expect(vandaagIn(BRUSSEL, nu)).toBe("2026-10-22");
    expect(vandaagIn("Europe/London", nu)).toBe("2026-10-21");
  });

  it("herkent verleden en toekomst", () => {
    expect(isInVerleden("2020-01-01", "12:00", BRUSSEL)).toBe(true);
    expect(isInVerleden("2099-01-01", "12:00", BRUSSEL)).toBe(false);
    // 10:30 UTC = 12:30 in Brussel, 11:30 in Londen: 12:00 is enkel in Brussel al voorbij.
    const nu = new Date("2026-07-15T10:30:00Z");
    expect(isInVerleden("2026-07-15", "12:00", BRUSSEL, nu)).toBe(true);
    expect(isInVerleden("2026-07-15", "12:00", "Europe/London", nu)).toBe(false);
  });

  it("valideert tijdzones", () => {
    expect(isGeldigeTijdzone("Europe/Brussels")).toBe(true);
    expect(isGeldigeTijdzone("Mars/Olympus")).toBe(false);
  });
});
