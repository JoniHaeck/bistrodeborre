"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActieState } from "@/components/admin/ActieFormulier";
import { adminContext } from "@/lib/admin/auth";

const vinkje = z.preprocess((v) => v === "on", z.boolean());
const geheel = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const schema = z.object({
  restaurant_naam: z.string().trim().min(1, "Naam is verplicht.").max(100),
  standaard_capaciteit: geheel(0, 500),
  max_groepsgrootte: geheel(1, 100),
  boekingshorizon_dagen: geheel(1, 730),
  min_voorboekingsuren: geheel(0, 720),
  herinnering_uren_vooraf: geheel(1, 168),
  herinneringen_actief: vinkje,
  notificatie_email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Ongeldig notificatie-e-mailadres.")
    .transform((v) => v || null),
  widget_primaire_kleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Kies een geldige kleur."),
  widget_lettertype: z.string().trim().regex(/^[\w ,'"-]{1,100}$/, "Ongeldig lettertype (enkel letters, cijfers, spaties, komma's)."),
  menu_link: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "De menulink moet met http(s):// beginnen.")
    .transform((v) => v || null),
});

export async function bewaarInstellingen(slug: string, formData: FormData): Promise<ActieState> {
  const { db, restaurant } = await adminContext(slug);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fout: parsed.error.issues[0]?.message ?? "Controleer de gegevens." };
  const { restaurant_naam, ...instellingen } = parsed.data;
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    db.from("restaurants").update({ naam: restaurant_naam }).eq("id", restaurant.id),
    db.from("settings").update(instellingen).eq("restaurant_id", restaurant.id),
  ]);
  const error = e1 ?? e2;
  if (error) {
    console.error("Instellingen opslaan mislukt", error);
    return { fout: "Opslaan mislukt." };
  }
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: "Instellingen opgeslagen." };
}
