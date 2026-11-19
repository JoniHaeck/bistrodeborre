import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reset: vi.fn(), client: vi.fn(), siteUrl: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.client }));
vi.mock("@/lib/email/send", () => ({ siteUrl: mocks.siteUrl }));

const { vraagHerstelAan } = await import("@/app/login/wachtwoord-vergeten/actions");

function aanvraag(email: string) {
  const form = new FormData();
  form.set("email", email);
  return vraagHerstelAan(form);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.siteUrl.mockReturnValue("https://www.tafelvrij.be");
  mocks.client.mockReturnValue({ auth: { resetPasswordForEmail: mocks.reset } });
  mocks.reset.mockResolvedValue({ data: {}, error: null });
});

describe("wachtwoordherstel aanvragen", () => {
  it("verstuurt een herstellink naar de bestaande toegestane route zonder PKCE", async () => {
    const resultaat = await aanvraag("  beheer@example.org  ");
    expect(resultaat?.ok).toContain("Als er een account");
    expect(mocks.client.mock.calls[0][2]).toEqual(expect.objectContaining({
      auth: expect.objectContaining({ flowType: "implicit", persistSession: false }),
    }));
    expect(mocks.reset).toHaveBeenCalledWith("beheer@example.org", { redirectTo: "https://www.tafelvrij.be/uitnodiging" });
  });

  it("weigert ongeldige e-mailadressen zonder aanvraag", async () => {
    expect((await aanvraag("geen-adres"))?.fout).toContain("geldig e-mailadres");
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("geeft een foutmelding als Supabase de aanvraag niet kan verwerken", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.reset.mockResolvedValue({ data: null, error: new Error("SMTP fout") });
    expect((await aanvraag("beheer@example.org"))?.fout).toContain("niet verwerkt");
    log.mockRestore();
  });

  it("geeft een foutmelding bij een netwerkfout", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.reset.mockRejectedValue(new Error("netwerkfout"));
    expect((await aanvraag("beheer@example.org"))?.fout).toContain("niet verwerkt");
    log.mockRestore();
  });

  it("weigert een ongeldige site-URL", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.siteUrl.mockReturnValue("ongeldig");
    expect((await aanvraag("beheer@example.org"))?.fout).toContain("niet beschikbaar");
    expect(mocks.reset).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
