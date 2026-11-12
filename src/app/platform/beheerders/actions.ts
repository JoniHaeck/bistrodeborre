"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ingelogdeDb, isSuperadmin } from "@/lib/admin/auth";
import { verwijderAccount, zetBlokkering } from "@/lib/server/platform-beheerders";
import type { ActieState } from "@/components/admin/ActieFormulier";

async function vereisSuperadmin() {
  const db = await ingelogdeDb();
  if (!(await isSuperadmin(db))) throw new Error("Enkel voor superadmins.");
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new Error("Sessie kon niet worden gecontroleerd.");
  return data.user.id;
}

function ververs() {
  revalidatePath("/platform");
  revalidatePath("/platform/beheerders");
  revalidatePath("/app", "layout");
}

export async function wijzigToegang(userId: string, restaurantId: string, formData: FormData): Promise<ActieState> {
  await vereisSuperadmin();
  const actie = z.enum(["blokkeer", "herstel"]).safeParse(formData.get("actie"));
  if (!z.string().uuid().safeParse(userId).success || !z.string().uuid().safeParse(restaurantId).success || !actie.success) {
    return { fout: "Ongeldige aanvraag." };
  }
  if (actie.data === "blokkeer" && formData.get("bevestig") !== "ja") {
    return { waarschuwing: "Deze beheerder verliest onmiddellijk toegang tot dit restaurant. Andere restaurantkoppelingen blijven actief." };
  }
  try {
    const resultaat = await zetBlokkering(userId, restaurantId, actie.data === "blokkeer");
    if (resultaat.ok) ververs();
    return resultaat;
  } catch (error) {
    console.error("Toegang wijzigen mislukt", error);
    return { fout: "Toegang wijzigen mislukt. Probeer opnieuw." };
  }
}

export async function verwijderBeheerder(userId: string, formData: FormData): Promise<ActieState> {
  const huidigId = await vereisSuperadmin();
  const bevestiging = z.string().email().max(254).safeParse(formData.get("email"));
  if (!z.string().uuid().safeParse(userId).success || !bevestiging.success) {
    return { fout: "Vul het e-mailadres in om de verwijdering te bevestigen." };
  }
  if (formData.get("bevestig") !== "ja") {
    return { waarschuwing: "Het account wordt definitief verwijderd, inclusief toegang tot ALLE gekoppelde restaurants. Dit kan niet ongedaan worden gemaakt." };
  }
  try {
    const resultaat = await verwijderAccount(userId, huidigId, bevestiging.data);
    if (resultaat.ok) ververs();
    return resultaat;
  } catch (error) {
    console.error("Beheerder verwijderen mislukt", error);
    return { fout: "Account verwijderen mislukt. Probeer opnieuw." };
  }
}
