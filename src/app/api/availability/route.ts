import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBeschikbareDagen, getBeschikbareSlots } from "@/lib/availability";
import { laadAvailabilityContext } from "@/lib/availability-data";

const query = z.object({
  aantal: z.coerce.number().int().min(1).max(100),
  datum: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * GET /api/availability?aantal=2           -> beschikbare dagen
 * GET /api/availability?aantal=2&datum=... -> beschikbare slots van die dag
 */
export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ fout: "Ongeldige aanvraag." }, { status: 400 });
  }
  const { aantal, datum } = parsed.data;

  try {
    const ctx = await laadAvailabilityContext();
    if (aantal > ctx.instellingen.max_groepsgrootte) {
      return NextResponse.json(
        { fout: "groep_te_groot", maxGroepsgrootte: ctx.instellingen.max_groepsgrootte },
        { status: 422 },
      );
    }

    if (!datum) {
      return NextResponse.json({ dagen: getBeschikbareDagen(aantal, ctx) });
    }

    const slots = getBeschikbareSlots(datum, aantal, ctx).map((s) => ({
      tijdslot: s.tijdslot,
      shift: s.shiftNaam,
    }));
    return NextResponse.json({ datum, slots });
  } catch {
    return NextResponse.json({ fout: "Beschikbaarheid kon niet geladen worden." }, { status: 500 });
  }
}
