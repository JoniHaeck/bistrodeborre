"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActieState } from "@/components/admin/ActieFormulier";
import { ingelogdeDb, isSuperadmin } from "@/lib/admin/auth";
import { koppelBeheerder, maakRestaurant, maakSlug, nodigBeheerderUit, slugFout } from "@/lib/server/platform";
import { siteUrl } from "@/lib/email/send";

/** Elke platformactie begint hiermee: enkel superadmins. */
async function vereisSuperadmin() {
  const db = await ingelogdeDb();
  if (!(await isSuperadmin(db))) throw new Error("Enkel voor superadmins.");
  return db;
}

const email = z.string().trim().toLowerCase().email("Ongeldig e-mailadres.").max(200);
const GEEN_ACCOUNT =
  "maar er bestaat nog geen account voor dat e-mailadres. Maak het aan in Supabase (Authentication → Users) en koppel het daarna hieronder.";

const nieuwSchema = z.object({
  naam: z.string().trim().min(1, "Geef een naam.").max(100),
  slug: z.string().trim().toLowerCase().max(40).optional(),
  eigenaar: z.union([z.literal(""), email]).optional(),
});

export async function nieuwRestaurant(formData: FormData): Promise<ActieState> {
  await vereisSuperadmin();
  const parsed = nieuwSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fout: parsed.error.issues[0]?.message ?? "Controleer de gegevens." };
  const { naam, eigenaar } = parsed.data;
  const slug = parsed.data.slug || maakSlug(naam);
  const fout = slugFout(slug);
  if (fout) return { fout };

  const { data, error } = await maakRestaurant({ naam, slug, email: eigenaar || null });
  if (error || !data) {
    if (error?.code === "23505") return { fout: `De slug "${slug}" is al in gebruik.` };
    console.error("Restaurant aanmaken mislukt", error);
    return { fout: "Aanmaken mislukt." };
  }
  revalidatePath("/platform");
  revalidatePath("/platform/beheerders");

  if (!eigenaar) return { ok: `Restaurant "${naam}" aangemaakt (/${slug}).` };
  const k = await koppelBeheerder(data.id, eigenaar);
  if (k.ok) return { ok: `Restaurant "${naam}" aangemaakt (/${slug}) met ${eigenaar} als eigenaar.` };
  return {
    waarschuwing: `Restaurant "${naam}" is aangemaakt (/${slug}), ${k.reden === "geen_account" ? GEEN_ACCOUNT : "maar de eigenaar koppelen mislukte."}`,
  };
}

const koppelSchema = z.object({
  email,
  rol: z.enum(["eigenaar", "beheerder"]),
});

export async function voegBeheerderToe(restaurantId: string, formData: FormData): Promise<ActieState> {
  await vereisSuperadmin();
  if (!z.string().uuid().safeParse(restaurantId).success) return { fout: "Ongeldig restaurant." };
  const parsed = koppelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fout: parsed.error.issues[0]?.message ?? "Controleer de gegevens." };
  if (formData.get("actie") === "uitnodigen") {
    const url = siteUrl();
    if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) {
      return { fout: "Uitnodigen vereist een HTTPS-adres in NEXT_PUBLIC_SITE_URL." };
    }
    const resultaat = await nodigBeheerderUit(restaurantId, parsed.data.email, parsed.data.rol, `${url}/uitnodiging`);
    if (!resultaat.ok) return { fout: resultaat.fout ?? "Uitnodigen mislukt." };
    revalidatePath("/platform");
    revalidatePath("/platform/beheerders");
    return { ok: `Uitnodiging verstuurd naar ${parsed.data.email}. De beheerder stelt zelf een wachtwoord in.` };
  }
  const k = await koppelBeheerder(restaurantId, parsed.data.email, parsed.data.rol);
  if (!k.ok) {
    return { fout: k.reden === "geen_account" ? `Er bestaat nog geen account voor ${parsed.data.email}. Maak het eerst aan in Supabase (Authentication → Users).` : "Koppelen mislukt." };
  }
  revalidatePath("/platform");
  revalidatePath("/platform/beheerders");
  return { ok: `${parsed.data.email} is nu ${parsed.data.rol}.` };
}

const STATUSSEN = ["proef", "actief", "achterstallig", "opgezegd"] as const;

export async function zetRestaurantStatus(restaurantId: string, formData: FormData): Promise<ActieState> {
  const db = await vereisSuperadmin();
  const status = z.enum(STATUSSEN).safeParse(formData.get("status"));
  if (!status.success || !z.string().uuid().safeParse(restaurantId).success) return { fout: "Ongeldige aanvraag." };
  // Via de sessie-client: RLS laat superadmins elk restaurant bijwerken.
  const { error } = await db.from("restaurants").update({ status: status.data }).eq("id", restaurantId);
  if (error) return { fout: "Status wijzigen mislukt." };
  revalidatePath("/platform");
  return { ok: "Status bijgewerkt." };
}
