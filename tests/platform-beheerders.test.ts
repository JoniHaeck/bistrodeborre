import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: vi.fn(), membership: vi.fn(), update: vi.fn(), getUser: vi.fn(), deleteUser: vi.fn(),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => table === "platform_admins"
      ? { select: () => ({ eq: () => ({ maybeSingle: mocks.platform }) }) }
      : {
        select: () => ({ eq: mocks.membership }),
        update: mocks.update,
      },
    auth: { admin: { getUserById: mocks.getUser, deleteUser: mocks.deleteUser } },
  }),
}));

const { zetBlokkering, verwijderAccount } = await import("@/lib/server/platform-beheerders");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platform.mockResolvedValue({ data: null, error: null });
  mocks.membership.mockResolvedValue({ count: 2, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { email: "gast@example.be" } }, error: null });
  mocks.deleteUser.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { user_id: "id" }, error: null }) }) }) }) });
});

describe("platformbeheer van accounts", () => {
  it("beschermt platformbeheerders tegen blokkering en verwijdering", async () => {
    mocks.platform.mockResolvedValue({ data: { user_id: "ander" }, error: null });
    expect((await zetBlokkering("ander", "restaurant", true)).fout).toContain("platformbeheerder");
    expect((await verwijderAccount("ander", "ik", "gast@example.be")).fout).toContain("platformbeheerders");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it("beschermt het eigen account", async () => {
    expect((await verwijderAccount("ik", "ik", "gast@example.be")).fout).toContain("eigen account");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it("vereist een bestaand restaurantlid en het juiste e-mailadres", async () => {
    expect((await verwijderAccount("ander", "ik", "verkeerd@example.be")).fout).toContain("e-mailadres");
    mocks.membership.mockResolvedValue({ count: 0, error: null });
    expect((await verwijderAccount("ander", "ik", "gast@example.be")).fout).toContain("niet gekoppeld");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it("verwijdert een bevestigd account via Supabase Auth", async () => {
    expect((await verwijderAccount("ander", "ik", "gast@example.be")).ok).toContain("definitief verwijderd");
    expect(mocks.deleteUser).toHaveBeenCalledWith("ander");
  });
  it("wijzigt alleen de blokkering van een restaurantkoppeling", async () => {
    expect((await zetBlokkering("ander", "restaurant", true)).ok).toContain("geblokkeerd");
    expect(mocks.update).toHaveBeenCalledWith({ geblokkeerd: true });
  });
});
