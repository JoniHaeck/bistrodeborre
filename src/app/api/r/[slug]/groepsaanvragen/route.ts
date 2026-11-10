import { NextResponse, type NextRequest } from "next/server";
import { getSlotsVoorDatum } from "@/lib/availability";
import { laadAvailabilityContext } from "@/lib/availability-data";
import { publiekRestaurant } from "@/lib/server/restaurant";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { reservatieSchema } from "@/lib/validation";
import { z } from "zod";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/r/[slug]/groepsaanvragen">) {
  const restaurant = await publiekRestaurant((await params).slug);
  if (!restaurant) return NextResponse.json({ fout: "onbekend_restaurant" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = reservatieSchema.extend({ datum: z.iso.date("Ongeldige datum.") }).safeParse(body);
  if (!parsed.success) {
    const velden: Record<string, string> = {};
    for (const issue of parsed.error.issues) velden[String(issue.path[0] ?? "formulier")] ??= issue.message;
    return NextResponse.json({ fout: "validatie", velden }, { status: 400 });
  }
  const input = parsed.data;
  if (input.website) return NextResponse.json({ ok: true }, { status: 201 });
  try {
    const ctx = await laadAvailabilityContext(restaurant);
    if (input.aantal <= ctx.instellingen.max_groepsgrootte) {
      return NextResponse.json({ fout: "geen_groep", bericht: "Gebruik het gewone reservatieformulier voor dit aantal personen." }, { status: 422 });
    }
    const slot = getSlotsVoorDatum(input.datum, ctx).find((s) => s.tijdslot === input.tijdslot && !s.gesloten);
    if (!slot) return NextResponse.json({ fout: "niet_beschikbaar", bericht: "Dit tijdstip is niet beschikbaar. Kies een ander tijdstip." }, { status: 422 });
    const { error } = await createServiceRoleClient().from("groepsaanvragen").insert({
      restaurant_id: restaurant.id, datum: input.datum, tijdslot: input.tijdslot,
      shift_template_id: slot.shiftId, aantal_personen: input.aantal,
      voornaam: input.voornaam, naam: input.naam, email: input.email,
      telefoon: input.telefoon, opmerking: input.opmerking, menu: input.menu,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Groepsaanvraag aanmaken mislukt", error);
    return NextResponse.json({ fout: "server", bericht: "Aanvragen is momenteel niet mogelijk. Probeer het later opnieuw." }, { status: 500 });
  }
}
