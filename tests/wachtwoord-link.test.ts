import { beforeEach, describe, expect, it, vi } from "vitest";
import { controleerWachtwoordLink } from "@/lib/wachtwoord-link";

const waarden = new Map<string, string>();
const opslag = {
  getItem: (key: string) => waarden.get(key) ?? null,
  setItem: (key: string, value: string) => { waarden.set(key, value); },
  removeItem: (key: string) => { waarden.delete(key); },
};
const auth = { setSession: vi.fn(), getUser: vi.fn() };

beforeEach(() => {
  waarden.clear();
  vi.resetAllMocks();
  auth.setSession.mockResolvedValue({ data: { user: { id: "gebruiker-1" } }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: { id: "gebruiker-1" } }, error: null });
});

describe("wachtwoordlink controleren", () => {
  it.each([["recovery", "herstel-gebruiker"], ["invite", "uitnodiging-gebruiker"]])(
    "aanvaardt een %s-link en onthoudt de juiste gebruiker",
    async (type, key) => {
      expect(await controleerWachtwoordLink(`#access_token=abc&refresh_token=def&type=${type}`, opslag, () => auth)).toBe(true);
      expect(auth.setSession).toHaveBeenCalledWith({ access_token: "abc", refresh_token: "def" });
      expect(opslag.getItem(key)).toBe("gebruiker-1");
    },
  );
  it("weigert een gewone sessie zonder herstellink", async () => {
    expect(await controleerWachtwoordLink("", opslag, () => auth)).toBe(false);
    expect(auth.getUser).not.toHaveBeenCalled();
  });
  it("weigert verlopen of andere links en wist oude herstelstatus", async () => {
    opslag.setItem("herstel-gebruiker", "gebruiker-1");
    expect(await controleerWachtwoordLink("#error=access_denied", opslag, () => auth)).toBe(false);
    expect(opslag.getItem("herstel-gebruiker")).toBeNull();
    expect(await controleerWachtwoordLink("#access_token=a&refresh_token=b&type=signup", opslag, () => auth)).toBe(false);
    expect(auth.setSession).not.toHaveBeenCalled();
  });
  it("weigert een link die Supabase niet kan valideren", async () => {
    auth.setSession.mockResolvedValue({ data: { user: null }, error: new Error("verlopen") });
    expect(await controleerWachtwoordLink("#access_token=a&refresh_token=b&type=recovery", opslag, () => auth)).toBe(false);
    expect(opslag.getItem("herstel-gebruiker")).toBeNull();
  });
  it("kan na herladen enkel met dezelfde geldige gebruiker verder", async () => {
    opslag.setItem("herstel-gebruiker", "gebruiker-1");
    expect(await controleerWachtwoordLink("", opslag, () => auth)).toBe(true);
    auth.getUser.mockResolvedValue({ data: { user: { id: "ander" } }, error: null });
    expect(await controleerWachtwoordLink("", opslag, () => auth)).toBe(false);
  });
});
