import { Resend } from "resend";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { PRODUCT_NAAM } from "@/lib/product";
import { STANDAARD_TIJDZONE } from "@/lib/time";
import { bevestigingMail, herinneringMail, restaurantMelding, type MailContext, type MailReservatie } from "./templates";

type Soort = "bevestiging" | "melding" | "herinnering";
type ReservatieRij = MailReservatie & { id: string; restaurant_id: string };

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Het verzendadres van het platform (één geverifieerd domein voor alle restaurants).
 * `EMAIL_FROM_ADRES=reservaties@tafelvrij.be`; een oud `EMAIL_FROM="Naam <adres>"` werkt ook.
 */
export function afzenderAdres(env: Record<string, string | undefined> = process.env): string {
  const adres = env.EMAIL_FROM_ADRES?.trim() || env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] || env.EMAIL_FROM?.trim();
  return adres || "onboarding@resend.dev";
}

/** `"Bistro de Borre via Tafelvrij" <reservaties@tafelvrij.be>`; tekens die de header breken, vallen weg. */
export function afzender(restaurantNaam: string, adres = afzenderAdres()): string {
  const naam = restaurantNaam.replace(/["<>\\\r\n]/g, "").trim();
  return `"${naam ? `${naam} via ${PRODUCT_NAAM}` : PRODUCT_NAAM}" <${adres}>`;
}

export async function laadMailInstellingen(restaurantId: string) {
  const db = createServiceRoleClient();
  const [{ data: restaurant }, { data }] = await Promise.all([
    db.from("restaurants").select("naam, email, tijdzone").eq("id", restaurantId).single(),
    db
      .from("settings")
      .select("notificatie_email, widget_primaire_kleur, logo_url, herinneringen_actief, herinnering_uren_vooraf")
      .eq("restaurant_id", restaurantId)
      .single(),
  ]);
  const ctx: MailContext = {
    restaurantNaam: restaurant?.naam ?? "",
    siteUrl: siteUrl(),
    kleur: data?.widget_primaire_kleur,
    logoUrl: data?.logo_url ?? null,
    // Antwoorden van gasten gaan naar het restaurant, niet naar het platform.
    antwoordAan: restaurant?.email || data?.notificatie_email || null,
  };
  return {
    ctx,
    notificatieEmail: data?.notificatie_email || null,
    herinneringenActief: data?.herinneringen_actief ?? true,
    herinneringUren: data?.herinnering_uren_vooraf ?? 24,
    tijdzone: restaurant?.tijdzone ?? STANDAARD_TIJDZONE,
  };
}

/** Verstuurt één mail en schrijft het resultaat naar het logboek van de reservatie. Gooit nooit. */
async function verstuur(
  soort: Soort,
  r: ReservatieRij,
  aan: string,
  ctx: MailContext,
  mail: { subject: string; html: string; text: string },
  antwoordAan: string | null,
): Promise<boolean> {
  let fout: string | null = null;
  try {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY ontbreekt");
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: afzender(ctx.restaurantNaam),
      to: aan,
      ...(antwoordAan ? { replyTo: antwoordAan } : {}),
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
      restaurant_id: r.restaurant_id,
      reservation_id: r.id,
      actie: fout ? `mail_${soort}_mislukt` : `mail_${soort}`,
      details: { aan, ...(fout ? { fout } : {}) },
    });
  return !fout;
}

/** Bevestiging naar de gast + melding naar het restaurant (antwoorden op de melding gaan naar de gast). */
export async function stuurNieuweReservatieMails(r: ReservatieRij) {
  const { ctx, notificatieEmail } = await laadMailInstellingen(r.restaurant_id);
  await Promise.all([
    verstuur("bevestiging", r, r.email, ctx, bevestigingMail(r, ctx), ctx.antwoordAan ?? null),
    notificatieEmail ? verstuur("melding", r, notificatieEmail, ctx, restaurantMelding(r, ctx), r.email) : null,
  ]);
}

/**
 * Verstuurt een herinnering en markeert reminder_sent_at. Bij een fout wordt de markering teruggezet (tenzij handmatig).
 * Een meegegeven `ctx` moet bij het restaurant van de reservatie horen.
 */
export async function stuurHerinnering(r: ReservatieRij, ctx?: MailContext): Promise<boolean> {
  const context = ctx ?? (await laadMailInstellingen(r.restaurant_id)).ctx;
  const ok = await verstuur("herinnering", r, r.email, context, herinneringMail(r, context), context.antwoordAan ?? null);
  if (ok) {
    await createServiceRoleClient()
      .from("reservations")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", r.id);
  }
  return ok;
}
