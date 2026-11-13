import { z } from "zod";
import { Resend } from "resend";
import { afzender } from "@/lib/email/send";

export const contactSchema = z.object({
  naam: z.string().trim().min(1, "Vul je naam in.").max(100, "Naam is te lang."),
  restaurant: z.string().trim().min(1, "Vul de naam van je restaurant in.").max(120, "Restaurantnaam is te lang."),
  email: z.string().trim().email("Vul een geldig e-mailadres in.").max(254, "E-mailadres is te lang."),
  bericht: z.string().trim().min(10, "Vertel ons iets meer (minstens 10 tekens).").max(3000, "Je bericht is te lang."),
  website: z.string().max(200).optional(),
});

export type ContactState = { fout?: string; ok?: string };

export async function verstuurContact(formData: FormData): Promise<ContactState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fout: parsed.error.issues[0]?.message ?? "Controleer je gegevens." };
  if (parsed.data.website) {
    console.warn("Contactaanvraag geweigerd door spamfilter");
    return { fout: "Je aanvraag kon niet worden verstuurd. Probeer opnieuw." };
  }
  if (!process.env.RESEND_API_KEY) {
    console.error("Contactaanvraag mislukt: RESEND_API_KEY ontbreekt");
    return { fout: "Versturen lukt momenteel niet. Probeer later opnieuw." };
  }
  const { naam, restaurant, email, bericht } = parsed.data;
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: afzender(""),
      to: process.env.CONTACT_EMAIL || "joni.haeck@gmail.com",
      replyTo: email,
      subject: "Nieuwe aanvraag via Tafelvrij",
      text: `Naam: ${naam}\nRestaurant: ${restaurant}\nE-mail: ${email}\n\nBericht:\n${bericht}`,
    });
    if (error) {
      console.error("Contactaanvraag versturen mislukt", error);
      return { fout: "Versturen lukt momenteel niet. Probeer later opnieuw." };
    }
    return { ok: "Bedankt! Je bericht is verstuurd. We nemen zo snel mogelijk contact met je op." };
  } catch (error) {
    console.error("Contactaanvraag versturen mislukt", error);
    return { fout: "Versturen lukt momenteel niet. Probeer later opnieuw." };
  }
}
