import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  restaurant: vi.fn(),
  rpc: vi.fn(),
  invite: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => table === "restaurants"
      ? { select: () => ({ eq: () => ({ maybeSingle: mocks.restaurant }) }) }
      : { upsert: mocks.upsert },
    rpc: mocks.rpc,
    auth: { admin: { inviteUserByEmail: mocks.invite, getUserById: mocks.getUser, updateUserById: mocks.updateUser } },
  }),
}));

const { nodigBeheerderUit } = await import("@/lib/server/platform");
const uitvoer = () => nodigBeheerderUit("rest-a", "nieuw@example.org", "beheerder", "https://app.example.org/uitnodiging");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.restaurant.mockResolvedValue({ data: { id: "rest-a", naam: "Bistro de Borre" }, error: null });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.invite.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
});

describe("beheerder uitnodigen", () => {
  it("verstuurt een uitnodiging en koppelt de gebruiker enkel aan het gekozen restaurant", async () => {
    expect(await uitvoer()).toEqual({ ok: true });
    expect(mocks.invite).toHaveBeenCalledWith("nieuw@example.org", {
      redirectTo: "https://app.example.org/uitnodiging",
      data: { uitnodiging_restaurant: "Bistro de Borre" },
    });
    expect(mocks.upsert).toHaveBeenCalledWith({ user_id: "user-1", restaurant_id: "rest-a", rol: "beheerder" }, { onConflict: "user_id,restaurant_id" });
  });
  it("verstuurt geen uitnodiging voor een bestaand bevestigd account", async () => {
    mocks.rpc.mockResolvedValue({ data: "user-1", error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-01-01", invited_at: null } }, error: null });
    expect((await uitvoer()).fout).toContain("bestaat al");
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it("meldt expliciet als het account is uitgenodigd maar koppelen mislukt", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.upsert.mockResolvedValue({ error: new Error("database down") });
    expect((await uitvoer()).fout).toContain("uitnodiging is verstuurd, maar koppelen mislukte");
    log.mockRestore();
  });
  it("vernieuwt de restaurantnaam bij een heruitnodiging en bewaart overige metadata", async () => {
    mocks.rpc.mockResolvedValue({ data: "user-1", error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: null, invited_at: "2026-01-01", user_metadata: { taal: "nl", uitnodiging_restaurant: "Oud restaurant" } } }, error: null });
    expect(await uitvoer()).toEqual({ ok: true });
    expect(mocks.updateUser).toHaveBeenCalledWith("user-1", { user_metadata: { taal: "nl", uitnodiging_restaurant: "Bistro de Borre" } });
    expect(mocks.invite).toHaveBeenCalledOnce();
  });
  it("verstuurt geen heruitnodiging als bijwerken van metadata mislukt", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: "user-1", error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: null, invited_at: "2026-01-01", user_metadata: {} } }, error: null });
    mocks.updateUser.mockResolvedValue({ error: new Error("database down") });
    expect((await uitvoer()).fout).toContain("Uitnodigingsgegevens bijwerken mislukt");
    expect(mocks.invite).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
