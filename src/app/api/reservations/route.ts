import { NextResponse, after, type NextRequest } from "next/server";
import { reservatieSchema } from "@/lib/validation";
import { valideerReservatie } from "@/lib/availability";
import { laadAvailabilityContext } from "@/lib/availability-data";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { stuurNieuweReservatieMails } from "@/lib/email/send";

/** Publiek: nieuwe reservatie. Alle validatie gebeurt hier, de database controleert de capaciteit nogmaals atomair. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = reservatieSchema.safeParse(body);

  if (!parsed.success) {
    const velden: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      velden[String(issue.path[0] ?? "formulier")] ??= issue.message;
    }
    return NextResponse.json({ fout: "validatie", velden }, { status: 400 });
  }

  const input = parsed.data;
  if (input.website) {
    // Bot: doe alsof het gelukt is.
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  try {
    const ctx = await laadAvailabilityContext();
    const resultaat = valideerReservatie(input, ctx);
    if (!resultaat.ok) {
      const status = resultaat.code === "volzet" ? 409 : 422;
      return NextResponse.json({ fout: resultaat.code, bericht: resultaat.bericht }, { status });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("create_reservation", {
      p_datum: input.datum,
      p_tijdslot: input.tijdslot,
      p_aantal_personen: input.aantal,
      p_voornaam: input.voornaam,
      p_naam: input.naam,
      p_email: input.email,
      p_telefoon: input.telefoon,
      // De gegenereerde types markeren functieargumenten niet als nullable; null is geldig.
      p_opmerking: input.opmerking as string,
      p_menu: input.menu,
      p_shift_template_id: resultaat.slot.shiftId,
      p_capaciteit: resultaat.slot.capaciteit,
      p_bron: "online",
    });

    if (error) {
      // P0002: net volzet geraakt door een gelijktijdige boeking.
      if (error.message.includes("volzet")) {
        return NextResponse.json(
          { fout: "volzet", bericht: "Dit tijdstip is helaas net volzet. Kies gerust een ander tijdstip." },
          { status: 409 },
        );
      }
      throw error;
    }

    // Mails na de respons versturen: een mailfout mag een geslaagde boeking nooit blokkeren.
    after(() => stuurNieuweReservatieMails(data));

    return NextResponse.json(
      {
        ok: true,
        reservatie: {
          id: data.id,
          datum: data.datum,
          tijdslot: data.tijdslot.slice(0, 5),
          aantal: data.aantal_personen,
          menu: data.menu,
          voornaam: data.voornaam,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    console.error("Reservatie aanmaken mislukt", e);
    return NextResponse.json(
      { fout: "server", bericht: "Er ging iets mis. Probeer het later opnieuw of bel ons." },
      { status: 500 },
    );
  }
}
