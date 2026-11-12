import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ laad: vi.fn(), rpc: vi.fn(), mail: vi.fn(), context: vi.fn() }));
vi.mock("@/lib/server/gast-reservatie", () => ({
  laadGastReservatie: mocks.laad,
  gastKanWijzigen: () => true,
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceRoleClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/availability-data", () => ({ laadAvailabilityContext: mocks.context }));
vi.mock("@/lib/email/send", () => ({ stuurBevestiging: mocks.mail }));

const { POST } = await import("@/app/api/gast/[token]/route");
const token = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const reservatie = {
  id: "bbb", datum: "2030-01-01", tijdslot: "18:00:00", aantal_personen: 4,
  voornaam: "Jan", naam: "Peeters", email: "jan@example.be", telefoon: "+32123456789",
  opmerking: null, menu: false, status: "bevestigd", shift_template_id: "ccc",
};
const input = {
  actie: "wijzig", datum: "2030-01-01", tijdslot: "18:00", aantal: 4,
  voornaam: "Jan", naam: "Peeters", email: "jan@example.be", telefoon: "+32123456789",
  opmerking: "", menu: false,
};
const post = (body: object) => POST(new NextRequest(`http://localhost/api/gast/${token}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}), { params: Promise.resolve({ token }) });

describe("publiek gastbeheer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.laad.mockResolvedValue({
      reservatie, restaurant: { id: "rest", tijdzone: "Europe/Brussels" },
      settings: { max_groepsgrootte: 8 },
    });
    mocks.rpc.mockResolvedValue({ data: reservatie, error: null });
    mocks.mail.mockResolvedValue(true);
  });

  it("valideert contactgegevens vóór de databaseaanroep", async () => {
    const result = await post({ ...input, email: "ongeldig" });
    expect(result.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(result.headers.get("cache-control")).toBe("no-store");
  });

  it("slaat een wijziging op en meldt een mislukte bevestigingsmail zonder de wijziging te ontkennen", async () => {
    mocks.mail.mockResolvedValue(false);
    const result = await post(input);
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ ok: true, mailVerstuurd: false });
    expect(mocks.rpc).toHaveBeenCalledWith("beheer_reservatie", expect.objectContaining({ p_token: token, p_actie: "wijzig" }));
    expect(mocks.context).not.toHaveBeenCalled();
  });

  it("geeft de 24-uursbeperking door bij annulering", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "termijn_verstreken" } });
    const result = await post({ actie: "annuleer" });
    expect(result.status).toBe(422);
    expect((await result.json()).fout).toContain("24 uur");
    expect(mocks.mail).not.toHaveBeenCalled();
  });
});
