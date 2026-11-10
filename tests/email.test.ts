import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/service", () => ({ createServiceRoleClient: () => ({}) }));

const { afzender, afzenderAdres } = await import("@/lib/email/send");
const { bevestigingMail, herinneringMail, restaurantMelding } = await import("@/lib/email/templates");

const r = {
  voornaam: "Jan", naam: "Peeters", email: "jan@x.be", telefoon: null, opmerking: null,
  datum: "2026-10-23", tijdslot: "19:00:00", aantal_personen: 2, menu: false, cancel_token: "abc",
};

describe("afzender", () => {
  it("toont het restaurant via Tafelvrij", () => {
    expect(afzender("Bistro de Borre", "reservaties@tafelvrij.be")).toBe('"Bistro de Borre via Tafelvrij" <reservaties@tafelvrij.be>');
  });

  it("haalt tekens weg die de header breken", () => {
    expect(afzender('Chez "Bob" <x>\r\nBcc: a@b.c', "r@t.be")).toBe('"Chez Bob xBcc: a@b.c via Tafelvrij" <r@t.be>');
    expect(afzender("", "r@t.be")).toBe('"Tafelvrij" <r@t.be>');
  });

  it("leest het adres uit EMAIL_FROM_ADRES of een oud EMAIL_FROM", () => {
    expect(afzenderAdres({ EMAIL_FROM_ADRES: "a@t.be" })).toBe("a@t.be");
    expect(afzenderAdres({ EMAIL_FROM: "Bistro <b@t.be>" })).toBe("b@t.be");
    expect(afzenderAdres({})).toBe("onboarding@resend.dev");
  });
});

describe("mailtemplates", () => {
  const ctx = { restaurantNaam: "Bistro <de> Borre", siteUrl: "https://app.tafelvrij.be", kleur: "#123456" };

  it("toont de naam (ge-escaped), de kleur en de footer", () => {
    const { html } = bevestigingMail(r, ctx);
    expect(html).toContain("Bistro &lt;de&gt; Borre");
    expect(html).toContain("#123456");
    expect(html).toContain("Reservatie via Tafelvrij");
    expect(html).toContain("https://app.tafelvrij.be/annuleren/abc");
  });

  it("toont enkel een https-logo en negeert een ongeldige kleur", () => {
    expect(bevestigingMail(r, { ...ctx, logoUrl: "https://cdn.x/logo.png" }).html).toContain('<img src="https://cdn.x/logo.png"');
    expect(bevestigingMail(r, { ...ctx, logoUrl: "javascript:alert(1)" }).html).not.toContain("<img");
    expect(bevestigingMail(r, { ...ctx, kleur: "red;background:url(x)" }).html).not.toContain("url(x)");
  });

  it("voegt een veilige restaurant-specifieke reviewlink toe aan html en tekst", () => {
    const review = { ...ctx, googleReviewUrl: "https://g.page/r/abc/review?x=1&y=2" };
    for (const mail of [bevestigingMail(r, review), herinneringMail(r, review), restaurantMelding(r, review)]) {
      expect(mail.html).toContain('href="https://g.page/r/abc/review?x=1&amp;y=2"');
      expect(mail.text).toContain("https://g.page/r/abc/review?x=1&y=2");
    }
    expect(bevestigingMail(r, ctx).html).not.toContain("Google-review");
    expect(bevestigingMail(r, { ...ctx, googleReviewUrl: "javascript:alert(1)" }).html).not.toContain("Google-review");
  });

  it("gebruikt de ingestelde huisstijl met veilige font-fallback", () => {
    const html = bevestigingMail(r, { ...ctx, lettertype: '"Open Sans", sans-serif' }).html;
    expect(html).toContain("&quot;Open Sans&quot;, sans-serif");
    expect(html).toContain("'DM Serif Text',Georgia,serif");
    expect(html).toContain("#f3f3f0");
    expect(bevestigingMail(r, { ...ctx, lettertype: "Arial; background:red" }).html).not.toContain("background:red");
  });
});
