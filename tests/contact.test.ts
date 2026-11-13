import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
vi.mock("@/lib/supabase/service", () => ({ createServiceRoleClient: vi.fn() }));
const { verstuurContact } = await import("@/lib/contact");

function formulier(waarden: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    naam: "Kim", restaurant: "Bistro", email: "kim@example.be",
    bericht: "Ik wil graag meer informatie.", ...waarden,
  })) form.set(key, value);
  return form;
}

describe("contactformulier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "test");
    vi.stubEnv("EMAIL_FROM_ADRES", "noreply@tafelvrij.be");
    vi.stubEnv("CONTACT_EMAIL", "");
    mocks.send.mockResolvedValue({ error: null });
  });
  it("verstuurt naar de eigenaar met het adres van de aanvrager als reply-to", async () => {
    expect((await verstuurContact(formulier())).ok).toBeTruthy();
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      from: '"Tafelvrij" <noreply@tafelvrij.be>', to: "joni.haeck@gmail.com",
      replyTo: "kim@example.be", text: expect.stringContaining("Restaurant: Bistro"),
    }));
  });
  it("weigert ongeldige gegevens en een ingevuld spamveld", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await verstuurContact(formulier({ email: "ongeldig" }))).fout).toBeTruthy();
    expect((await verstuurContact(formulier({ website: "spam" }))).fout).toBeTruthy();
    expect(mocks.send).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("gebruikt de ingestelde ontvanger als die aanwezig is", async () => {
    vi.stubEnv("CONTACT_EMAIL", "contact@example.be");
    await verstuurContact(formulier());
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "contact@example.be" }));
  });
  it("meldt verzendfouten en ontbrekende configuratie", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockResolvedValue({ error: { message: "providerfout" } });
    expect((await verstuurContact(formulier())).fout).toBeTruthy();
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await verstuurContact(formulier())).fout).toBeTruthy();
    log.mockRestore();
  });
});
