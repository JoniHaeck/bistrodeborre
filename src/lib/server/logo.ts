import { createServiceRoleClient } from "@/lib/supabase/service";

const BUCKET = "logos";
export const LOGO_MAX_BYTES = 800 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export type LogoResultaat = { ok: true; url: string } | { ok: false; fout: string };

/** Controleert het bestand op type en grootte (ook aan de hand van de eerste bytes). */
export async function controleerLogo(bestand: File): Promise<string | null> {
  if (bestand.size === 0) return "Kies een afbeelding.";
  if (bestand.size > LOGO_MAX_BYTES) return "Het logo mag maximaal 800 KB zijn.";
  if (!TYPES[bestand.type]) return "Enkel PNG, JPG of WebP.";
  const b = new Uint8Array(await bestand.slice(0, 12).arrayBuffer());
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const webp = String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  if (!png && !jpg && !webp) return "Dit bestand is geen geldige afbeelding.";
  return null;
}

/**
 * Uploadt een nieuw logo voor een restaurant en verwijdert de oude bestanden.
 * De AANROEPER moet eerst bewijzen dat de gebruiker toegang heeft tot `restaurantId`
 * (adminContext() via de sessie-client): deze functie gebruikt de service-role.
 */
export async function uploadLogo(restaurantId: string, bestand: File): Promise<LogoResultaat> {
  const fout = await controleerLogo(bestand);
  if (fout) return { ok: false, fout };

  const opslag = createServiceRoleClient().storage.from(BUCKET);
  // Nieuwe naam per upload, zodat browsers en mailclients nooit een oud logo uit hun cache tonen.
  const pad = `${restaurantId}/logo-${Date.now()}.${TYPES[bestand.type]}`;
  const { error } = await opslag.upload(pad, bestand, { contentType: bestand.type, cacheControl: "31536000", upsert: false });
  if (error) {
    console.error("Logo uploaden mislukt", error);
    return { ok: false, fout: "Uploaden mislukt." };
  }
  await verwijderLogos(restaurantId, pad);
  return { ok: true, url: opslag.getPublicUrl(pad).data.publicUrl };
}

/** Verwijdert alle logobestanden van een restaurant, behalve `behoud`. Zie de waarschuwing bij uploadLogo. */
export async function verwijderLogos(restaurantId: string, behoud?: string) {
  const opslag = createServiceRoleClient().storage.from(BUCKET);
  const { data } = await opslag.list(restaurantId);
  const weg = (data ?? []).map((f) => `${restaurantId}/${f.name}`).filter((p) => p !== behoud);
  if (weg.length) await opslag.remove(weg);
}
