import { Resend } from "resend";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { bevestigingMail, herinneringMail, restaurantMelding, type MailContext, type MailReservatie } from "./templates";

type Soort = "bevestiging" | "melding" | "herinnering";
type ReservatieRij = MailReservatie & { id: string };

const FROM = () => process.env.EMAIL_FROM ?? "Bistro de Borre <onboarding@resend.dev>";

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function laadMailInstellingen() {
  const { data } = await createServiceRoleClient()
    .from("settings")
    .select("restaurant_naam, notificatie_email, widget_primaire_kleur, herinneringen_actief, herinnering_uren_vooraf")
    .eq("id", 1)
    .single();
  const ctx: MailContext = {
    restaurantNaam: data?.restaurant_naam ?? "Bistro de Borre",
    siteUrl: siteUrl(),
    kleur: data?.widget_primaire_kleur,
  };
  return {
    ctx,
    notificatieEmail: data?.notificatie_email || process.env.NOTIFICATION_EMAIL || null,
    herinneringenActief: data?.herinneringen_actief ?? true,
    herinneringUren: data?.herinnering_uren_vooraf ?? 24,
  };
}

/** Verstuurt één mail en schrijft het resultaat naar het logboek van de reservatie. Gooit nooit. */
async function verstuur(
  soort: Soort,
  reservationId: string,
  aan: string,
  mail: { subject: string; html: string; text: string },
): Promise<boolean> {
  let fout: string | null = null;
  try {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY ontbreekt");
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: FROM(),
      to: aan,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    if (error) fout = error.message;
  } catch (e) {
    fout = e instanceof Error ? e.message : String(e);
  }
  if (fout) console.error(`Mail ${soort} mislukt`, fout);

  await createServiceRoleClient()
    .from("reservation_logs")
    .insert({
      reservation_id: reservationId,
      actie: fout ? `mail_${soort}_mislukt` : `mail_${soort}`,
      details: { aan, ...(fout ? { fout } : {}) },
    });
  return !fout;
}

/** Bevestiging naar de gast + melding naar het restaurant. */
export async function stuurNieuweReservatieMails(r: ReservatieRij) {
  const { ctx, notificatieEmail } = await laadMailInstellingen();
  await Promise.all([
    verstuur("bevestiging", r.id, r.email, bevestigingMail(r, ctx)),
    notificatieEmail ? verstuur("melding", r.id, notificatieEmail, restaurantMelding(r, ctx)) : null,
  ]);
}

/** Verstuurt een herinnering en markeert reminder_sent_at. Bij een fout wordt de markering teruggezet (tenzij handmatig). */
export async function stuurHerinnering(r: ReservatieRij, ctx?: MailContext): Promise<boolean> {
  const context = ctx ?? (await laadMailInstellingen()).ctx;
  const ok = await verstuur("herinnering", r.id, r.email, herinneringMail(r, context));
  if (ok) {
    await createServiceRoleClient()
      .from("reservations")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", r.id);
  }
  return ok;
}
