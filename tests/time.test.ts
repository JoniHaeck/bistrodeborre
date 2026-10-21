import { describe, expect, it } from "vitest";
import { datumTijdslotNaarUtc, isInVerleden } from "@/lib/time";

describe("time helpers (Europe/Brussels)", () => {
  it("zet een wintertijd-datum correct om naar UTC (UTC+1)", () => {
    const utc = datumTijdslotNaarUtc("2026-01-15", "12:00");
    expect(utc.toISOString()).toBe("2026-01-15T11:00:00.000Z");
  });

  it("zet een zomertijd-datum correct om naar UTC (UTC+2)", () => {
    const utc = datumTijdslotNaarUtc("2026-07-15", "12:00");
    expect(utc.toISOString()).toBe("2026-07-15T10:00:00.000Z");
  });

  it("herkent een datum/tijdslot in het verleden", () => {
    expect(isInVerleden("2020-01-01", "12:00")).toBe(true);
  });

  it("herkent een datum/tijdslot in de toekomst", () => {
    expect(isInVerleden("2099-01-01", "12:00")).toBe(false);
  });
});
