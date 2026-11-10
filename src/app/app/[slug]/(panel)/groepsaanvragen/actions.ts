"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActieState } from "@/components/admin/ActieFormulier";
import { adminContext } from "@/lib/admin/auth";
import { stuurBevestiging } from "@/lib/email/send";

export async function bevestigGroep(slug: string, id: string, formData: FormData): Promise<ActieState> {
  const { db, restaurant } = await adminContext(slug);
  if (!z.string().uuid().safeParse(id).success) return { fout: "Ongeldige aanvraag." };
  const { data: reservatie, error } = await db.rpc("bevestig_groepsaanvraag", {
    p_restaurant_id: restaurant.id, p_id: id, p_overcapaciteit: formData.get("bevestig") === "ja",
  });
  if (error) {
    if (error.message.includes("overcapaciteit:")) {
      return { waarschuwing: `Let op: ${error.message}. De bestaande reservaties blijven behouden. Wilt u deze groep toch bevestigen?` };
    }
    if (error.message.includes("tijdstip niet meer beschikbaar")) return { fout: "Dit tijdstip is niet meer beschikbaar. Contacteer de gast om een alternatief af te spreken." };
    if (error.message.includes("al behandeld")) return { fout: "Deze aanvraag is al behandeld of niet gevonden. Vernieuw het overzicht." };
    console.error("Groepsaanvraag bevestigen mislukt", error);
    return { fout: "Bevestigen mislukt. Probeer opnieuw." };
  }
  revalidatePath(`/app/${slug}`, "layout");
  try {
    if (await stuurBevestiging(reservatie)) return { ok: "Groepsreservatie bevestigd en bevestigingsmail verstuurd." };
  } catch (error) {
    console.error("Bevestigingsmail groepsreservatie mislukt", error);
  }
  return { fout: "De reservatie is bevestigd, maar de e-mail kon niet verstuurd worden. Verstuur die opnieuw via het overzicht." };
}

export async function verstuurGroepsbevestiging(slug: string, id: string): Promise<ActieState> {
  const { db, restaurant } = await adminContext(slug);
  if (!z.string().uuid().safeParse(id).success) return { fout: "Ongeldige aanvraag." };
  const { data: aanvraag, error } = await db.from("groepsaanvragen").select("reservation_id")
    .eq("restaurant_id", restaurant.id).eq("id", id).eq("status", "bevestigd").maybeSingle();
  if (error) {
    console.error("Groepsaanvraag ophalen mislukt", error);
    return { fout: "Aanvraag ophalen mislukt." };
  }
  if (!aanvraag?.reservation_id) return { fout: "Geen bevestigde reservatie gevonden." };
  const { data: reservatie, error: reservatieFout } = await db.from("reservations").select("*")
    .eq("restaurant_id", restaurant.id).eq("id", aanvraag.reservation_id).single();
  if (reservatieFout || !reservatie) return { fout: "Reservatie ophalen mislukt." };
  try {
    const ok = await stuurBevestiging(reservatie);
    revalidatePath(`/app/${slug}/groepsaanvragen`);
    return ok ? { ok: "Bevestigingsmail verstuurd." } : { fout: "E-mail versturen mislukt. Zie het logboek van de reservatie." };
  } catch (error) {
    console.error("Bevestigingsmail groepsreservatie mislukt", error);
    return { fout: "E-mail versturen mislukt. Probeer opnieuw." };
  }
}
