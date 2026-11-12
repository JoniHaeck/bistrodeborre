import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { gastKanWijzigen, laadGastReservatie } from "@/lib/server/gast-reservatie";
import { laadAvailabilityContext } from "@/lib/availability-data";
import { getSlotsVoorDatum, slotSleutel } from "@/lib/availability";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { reservatieSchema } from "@/lib/validation";
import { stuurBevestiging } from "@/lib/email/send";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const antwoord = (body: object, status = 200) => NextResponse.json(body, { status, headers });

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const datum = z.iso.date().safeParse(request.nextUrl.searchParams.get("datum"));
  const aantal = z.coerce.number().int().min(1).max(100).safeParse(request.nextUrl.searchParams.get("aantal"));
  if (!datum.success || !aantal.success) return antwoord({ fout: "Ongeldige aanvraag." }, 400);
  try {
    const data = await laadGastReservatie(token);
    if (!data) return antwoord({ fout: "Deze link is ongeldig." }, 404);
    if (aantal.data > data.settings.max_groepsgrootte &&
      !(datum.data === data.reservatie.datum && aantal.data <= data.reservatie.aantal_personen))
      return antwoord({ fout: "Contacteer het restaurant voor een grotere groep." }, 422);
    const ctx = await laadAvailabilityContext(data.restaurant);
    const r = data.reservatie;
    if (r.status !== "geannuleerd") {
      const sleutel = slotSleutel(r.datum, r.tijdslot.slice(0, 5));
      ctx.bezetting[sleutel] = Math.max(0, (ctx.bezetting[sleutel] ?? 0) - r.aantal_personen);
    }
    const slots = getSlotsVoorDatum(datum.data, ctx)
      .filter((s) => aantal.data <= data.settings.max_groepsgrootte && !s.gesloten && s.vrij >= aantal.data)
      .map((s) => ({ tijdslot: s.tijdslot, shift: s.shiftNaam }));
    if (r.status === "bevestigd" && r.datum === datum.data && aantal.data <= r.aantal_personen &&
      !slots.some((s) => s.tijdslot === r.tijdslot.slice(0, 5))) {
      slots.unshift({ tijdslot: r.tijdslot.slice(0, 5), shift: "Huidige reservatie" });
    }
    return antwoord({ slots });
  } catch (error) {
    console.error("Beschikbaarheid voor wijziging laden mislukt", error);
    return antwoord({ fout: "Beschikbaarheid laden mislukt." }, 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body: unknown = await request.json().catch(() => null);
  const actie = z.object({ actie: z.enum(["wijzig", "annuleer"]) }).safeParse(body);
  if (!actie.success) return antwoord({ fout: "Ongeldige aanvraag." }, 400);
  try {
    const data = await laadGastReservatie(token);
    if (!data) return antwoord({ fout: "Deze link is ongeldig." }, 404);
    let input = {
      datum: data.reservatie.datum, tijdslot: data.reservatie.tijdslot.slice(0, 5),
      aantal: data.reservatie.aantal_personen, voornaam: data.reservatie.voornaam,
      naam: data.reservatie.naam, email: data.reservatie.email, telefoon: data.reservatie.telefoon ?? "",
      opmerking: data.reservatie.opmerking, menu: data.reservatie.menu,
    };
    let shiftId = data.reservatie.shift_template_id;
    if (actie.data.actie === "wijzig") {
      const parsed = reservatieSchema.extend({ datum: z.iso.date("Ongeldige datum.") }).safeParse(body);
      if (!parsed.success) return antwoord({ fout: parsed.error.issues[0]?.message ?? "Controleer de gegevens." }, 400);
      input = parsed.data;
      const behoudtSlot = input.datum === data.reservatie.datum && input.tijdslot === data.reservatie.tijdslot.slice(0, 5) && input.aantal <= data.reservatie.aantal_personen;
      if (input.aantal > data.settings.max_groepsgrootte && !behoudtSlot) return antwoord({ fout: "Contacteer het restaurant voor een grotere groep." }, 422);
      if (!behoudtSlot) {
        const ctx = await laadAvailabilityContext(data.restaurant);
        const slot = getSlotsVoorDatum(input.datum, ctx).find((s) => s.tijdslot === input.tijdslot && !s.gesloten);
        if (!slot) return antwoord({ fout: "Dit tijdstip is niet beschikbaar. Kies een ander tijdstip." }, 422);
        shiftId = slot.shiftId;
      }
    }
    const { error, data: gewijzigd } = await createServiceRoleClient().rpc("beheer_reservatie", {
      p_token: token, p_actie: actie.data.actie, p_datum: input.datum, p_tijdslot: input.tijdslot,
      p_aantal: input.aantal, p_voornaam: input.voornaam, p_naam: input.naam, p_email: input.email,
      p_telefoon: input.telefoon, p_opmerking: input.opmerking, p_menu: input.menu, p_shift_id: shiftId,
    });
    if (error) {
      if (error.message.includes("termijn_verstreken")) return antwoord({ fout: "Wijzigen of annuleren kan tot 24 uur vooraf. Contacteer het restaurant." }, 422);
      if (error.message.includes("niet_bevestigd")) return antwoord({ fout: "Deze reservatie kan niet meer gewijzigd worden." }, 422);
      if (error.message.includes("volzet") || error.message.includes("niet_beschikbaar")) return antwoord({ fout: "Dit tijdstip is niet meer beschikbaar. Kies een ander tijdstip." }, 409);
      console.error("Reservatie beheren mislukt", error);
      return antwoord({ fout: "De aanvraag kon niet verwerkt worden." }, 500);
    }
    if (actie.data.actie === "wijzig") {
      try {
        const mail = await stuurBevestiging(gewijzigd);
        return antwoord({ ok: true, mailVerstuurd: mail, wijzigbaar: gastKanWijzigen(gewijzigd.datum, gewijzigd.tijdslot, data.restaurant.tijdzone) });
      } catch (error) {
        console.error("Bevestigingsmail na wijziging mislukt", error);
        return antwoord({ ok: true, mailVerstuurd: false, wijzigbaar: gastKanWijzigen(gewijzigd.datum, gewijzigd.tijdslot, data.restaurant.tijdzone) });
      }
    }
    return antwoord({ ok: true });
  } catch (error) {
    console.error("Reservatie beheren mislukt", error);
    return antwoord({ fout: "De aanvraag kon niet verwerkt worden." }, 500);
  }
}
