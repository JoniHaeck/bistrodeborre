import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBeschikbareDagen, getBeschikbareSlots, getSlotsVoorDatum, voegDagenToe } from "@/lib/availability";
import { laadAvailabilityContext } from "@/lib/availability-data";
import { publiekRestaurant } from "@/lib/server/restaurant";
import { vandaagIn } from "@/lib/time";

const query = z.object({
  aantal: z.coerce.number().int().min(1).max(100),
  datum: z.iso.date().optional(),
  groep: z.enum(["1"]).optional(),
});

/**
 * GET /api/r/{slug}/availability?aantal=2           -> beschikbare dagen
 * GET /api/r/{slug}/availability?aantal=2&datum=... -> beschikbare slots van die dag
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/r/[slug]/availability">) {
  const restaurant = await publiekRestaurant((await params).slug);
  if (!restaurant) return NextResponse.json({ fout: "onbekend_restaurant" }, { status: 404 });

  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ fout: "Ongeldige aanvraag." }, { status: 400 });
  }
  const { aantal, datum, groep } = parsed.data;

  try {
    const ctx = await laadAvailabilityContext(restaurant);
    if (groep && aantal <= ctx.instellingen.max_groepsgrootte) {
      return NextResponse.json({ fout: "geen_groep" }, { status: 422 });
    }
    if (!groep && aantal > ctx.instellingen.max_groepsgrootte) {
      return NextResponse.json(
        { fout: "groep_te_groot", maxGroepsgrootte: ctx.instellingen.max_groepsgrootte },
        { status: 422 },
      );
    }

    if (groep && !datum) {
      const vandaag = vandaagIn(ctx.tijdzone, ctx.nu);
      const dagen = Array.from({ length: ctx.instellingen.boekingshorizon_dagen + 1 }, (_, i) => voegDagenToe(vandaag, i))
        .filter((d) => getSlotsVoorDatum(d, ctx).some((s) => !s.gesloten));
      return NextResponse.json({ dagen });
    }
    if (!datum) {
      return NextResponse.json({ dagen: getBeschikbareDagen(aantal, ctx) });
    }

    const slots = (groep ? getSlotsVoorDatum(datum, ctx).filter((s) => !s.gesloten) : getBeschikbareSlots(datum, aantal, ctx)).map((s) => ({
      tijdslot: s.tijdslot,
      shift: s.shiftNaam,
    }));
    return NextResponse.json({ datum, slots });
  } catch (error) {
    console.error("Beschikbaarheid laden mislukt", error);
    return NextResponse.json({ fout: "Beschikbaarheid kon niet geladen worden." }, { status: 500 });
  }
}
