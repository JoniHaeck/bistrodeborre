"use server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ActieState } from "@/components/admin/ActieFormulier";
import { siteUrl } from "@/lib/email/send";

export async function vraagHerstelAan(formData: FormData): Promise<ActieState> {
  const parsed = z.string().trim().email().max(200).safeParse(formData.get("email"));
  if (!parsed.success) return { fout: "Vul een geldig e-mailadres in." };

  let redirectTo: string;
  try {
    const url = new URL(siteUrl());
    if (!["http:", "https:"].includes(url.protocol) || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) {
      throw new Error("Ongeldig publiek adres");
    }
    redirectTo = new URL("/uitnodiging", url.origin).toString();
  } catch (error) {
    console.error("Adres voor wachtwoordherstel is ongeldig", error);
    return { fout: "Wachtwoordherstel is momenteel niet beschikbaar. Contacteer de platformbeheerder." };
  }

  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await db.auth.resetPasswordForEmail(parsed.data, { redirectTo });
    if (error) {
      console.error("Wachtwoordherstel aanvragen mislukt", error);
      return { fout: "De aanvraag kon niet verwerkt worden. Probeer later opnieuw." };
    }
  } catch (error) {
    console.error("Wachtwoordherstel aanvragen mislukt", error);
    return { fout: "De aanvraag kon niet verwerkt worden. Probeer later opnieuw." };
  }
  return { ok: "Als er een account met dit e-mailadres bestaat, ontvang je een e-mail met een link om je wachtwoord te herstellen." };
}
