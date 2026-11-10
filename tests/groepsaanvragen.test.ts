import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AvailabilityContext } from "@/lib/availability";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  restaurant: vi.fn(),
  context: vi.fn(),
}));
vi.mock("@/lib/server/restaurant", () => ({ publiekRestaurant: mocks.restaurant }));
vi.mock("@/lib/availability-data", () => ({ laadAvailabilityContext: mocks.context }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({ from: () => ({ insert: mocks.insert }) }),
}));

const { POST } = await import("@/app/api/r/[slug]/groepsaanvragen/route");
const { GET } = await import("@/app/api/r/[slug]/availability/route");
const params = { params: Promise.resolve({ slug: "demo" }) };
const datum = "2026-10-23";
const ctx: AvailabilityContext = {
  instellingen: { slot_minuten: 15, standaard_capaciteit: 8, max_groepsgrootte: 8, boekingshorizon_dagen: 30, min_voorboekingsuren: 0 },
  shiften: [{ id: "shift", weekdag: 5, naam: "Middag", start_tijd: "12:00", eind_tijd: "12:15", actief: true, capaciteit_per_slot: null }],
  uitzonderingen: [{ datum, shift_template_id: "shift", gesloten: false, geblokkeerd: false, geblokkeerde_tijdsloten: ["12:15"], afwijkende_capaciteit: null }],
  bezetting: { [`${datum}|12:00`]: 8 },
  nu: new Date("2026-10-21T08:00:00Z"),
  tijdzone: "Europe/Brussels",
};
const input = { datum, tijdslot: "12:00", aantal: 9, voornaam: "Jan", naam: "Test", email: "jan@example.org", telefoon: "+32123456789", menu: false };
const post = (body: object) => POST(new NextRequest("http://localhost/api/r/demo/groepsaanvragen", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), params);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.restaurant.mockResolvedValue({ id: "restaurant-a", slug: "demo", tijdzone: "Europe/Brussels" });
  mocks.context.mockResolvedValue(ctx);
  mocks.insert.mockResolvedValue({ error: null });
});

describe("groepsaanvragen", () => {
  it("toont volzette maar niet geblokkeerde tijdstippen", async () => {
    const response = await GET(new NextRequest(`http://localhost/api/r/demo/availability?aantal=9&groep=1&datum=${datum}`), params);
    expect(await response.json()).toEqual({ datum, slots: [{ tijdslot: "12:00", shift: "Middag" }] });
  });
  it("slaat een aanvraag voor een vol slot op, zonder een reservatie te maken", async () => {
    expect((await post(input)).status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ restaurant_id: "restaurant-a", aantal_personen: 9, shift_template_id: "shift" }));
  });
  it("weigert geblokkeerde tijdstippen en gewone groepsgroottes", async () => {
    expect((await post({ ...input, tijdslot: "12:15" })).status).toBe(422);
    expect((await post({ ...input, aantal: 8 })).status).toBe(422);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("weigert ongeldige datums en toont opslagfouten", async () => {
    expect((await post({ ...input, datum: "2026-02-31" })).status).toBe(400);
    mocks.insert.mockResolvedValue({ error: new Error("database down") });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post(input)).status).toBe(500);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
