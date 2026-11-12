import { describe, expect, it } from "vitest";
import { maakAgenda } from "@/lib/agenda";

const r = { id: "123", datum: "2026-03-29", tijdslot: "18:00:00", aantal_personen: 2, menu: true };
const nu = new Date("2026-01-01T10:00:00Z");

describe("agenda-export", () => {
  it("gebruikt de tijdzone en houdt rekening met zomertijd", () => {
    const zomer = maakAgenda(r, "Bistro", "Europe/Brussels", 120, nu);
    expect(zomer).toContain("DTSTART:20260329T160000Z\r\nDTEND:20260329T180000Z");
    const winter = maakAgenda({ ...r, datum: "2026-10-25" }, "Bistro", "Europe/Brussels", 90, nu);
    expect(winter).toContain("DTSTART:20261025T170000Z\r\nDTEND:20261025T183000Z");
    expect(winter.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("escapet tekst en vouwt op 75 bytes zonder unicode te splitsen", () => {
    const ics = maakAgenda(r, `${"é".repeat(40)},\\;\r\nEXTRA`, "Europe/Brussels", 120, nu);
    expect(ics.replace(/\r\n /g, "")).toContain("\\,\\\\\\;\\nEXTRA");
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(ics).not.toContain("\r\nEXTRA");
  });
});
