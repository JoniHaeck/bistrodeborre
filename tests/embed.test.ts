import { describe, expect, it } from "vitest";
import { maakEmbedcodes } from "@/lib/embed";

describe("Embedcodes per restaurant", () => {
  it("maakt inline- en popupcode met restaurant, opgeslagen kleur en correct escaped naam", () => {
    const resultaat = maakEmbedcodes("https://www.tafelvrij.be/", { slug: "bistro-de-borre", naam: 'Bistro "De Borre" & Co' }, "#8b8a69", true);
    expect(resultaat).toEqual({
      ok: true,
      inline: '<script src="https://www.tafelvrij.be/embed.js" data-restaurant="bistro-de-borre"></script>',
      popup: '<script src="https://www.tafelvrij.be/embed.js" data-restaurant="bistro-de-borre" data-modus="popup" data-naam="Bistro &quot;De Borre&quot; &amp; Co" data-kleur="#8b8a69" data-knop-tekst="Reserveer een tafel"></script>',
    });
  });

  it("gebruikt de slug van het gekozen restaurant", () => {
    const resultaat = maakEmbedcodes("https://www.tafelvrij.be", { slug: "ander-restaurant", naam: "Ander" }, "#123456", true);
    expect(resultaat.ok && resultaat.inline).toContain('data-restaurant="ander-restaurant"');
  });

  it.each([undefined, "", "geen-url", "http://localhost:3000", "https://example.com/pad", "https://user:pass@example.com", "https://example.com/?q=1"])(
    "weigert een ongeschikt productieadres: %s",
    (url) => {
      expect(maakEmbedcodes(url, { slug: "bistro-de-borre", naam: "Bistro" }, "#123456", true).ok).toBe(false);
    },
  );

  it("staat lokaal HTTP toe buiten productie", () => {
    expect(maakEmbedcodes("http://localhost:3000", { slug: "bistro-de-borre", naam: "Bistro" }, "#123456", false).ok).toBe(true);
  });

  it("weigert ongeldige slug en kleur", () => {
    expect(maakEmbedcodes("https://example.com", { slug: 'x" onclick="f', naam: "Bistro" }, "#123456", true).ok).toBe(false);
    expect(maakEmbedcodes("https://example.com", { slug: "bistro-de-borre", naam: "Bistro" }, 'red" onclick="f', true).ok).toBe(false);
  });
});
