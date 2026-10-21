"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActieState } from "@/components/admin/ActieFormulier";
import { adminDb } from "@/lib/admin/auth";

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
  notificatie_email: z.string().trim().email("Ongeldig notificatie-e-mailadres.").max(200),
  widget_primaire_kleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Kies een geldige kleur."),
  widget_lettertype: z.string().trim().regex(/^[\w ,'"-]{1,100}$/, "Ongeldig lettertype (enkel letters, cijfers, spaties, komma's)."),
  menu_link: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "De menulink moet met http(s):// beginnen.")
    .transform((v) => v || null),
});

export async function bewaarInstellingen(formData: FormData): Promise<ActieState> {
  const db = await adminDb();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fout: parsed.error.issues[0]?.message ?? "Controleer de gegevens." };
  const { error } = await db.from("settings").update(parsed.data).eq("id", 1);
  if (error) {
    console.error("Instellingen opslaan mislukt", error);
    return { fout: "Opslaan mislukt." };
  }
  revalidatePath("/admin", "layout");
  return { ok: "Instellingen opgeslagen." };
}
