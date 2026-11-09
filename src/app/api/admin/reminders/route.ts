import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { laadMailInstellingen, stuurHerinnering } from "@/lib/email/send";
import { standaardSlug } from "@/lib/server/restaurant";

const schema = z.union([
  z.object({ reservationId: z.string().uuid() }),
  z.object({ datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), shiftId: z.string().uuid() }),
]);

/**
 * Admin: herinnering (opnieuw) versturen voor één reservatie of een hele shift op een datum.
 * Leest via de sessie-client: RLS bepaalt tot welk restaurant de gebruiker toegang heeft.
 */
export async function POST(request: NextRequest) {
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ fout: "niet toegestaan" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ fout: "validatie" }, { status: 400 });

  const { data: restaurant } = await db.from("restaurants").select("id").eq("slug", standaardSlug()).maybeSingle();
  if (!restaurant) return NextResponse.json({ fout: "geen toegang" }, { status: 403 });

  const query = db.from("reservations").select("*").eq("restaurant_id", restaurant.id).neq("status", "geannuleerd");
  const { data, error } =
    "reservationId" in parsed.data
      ? await query.eq("id", parsed.data.reservationId)
      : await query.eq("datum", parsed.data.datum).eq("shift_template_id", parsed.data.shiftId);
  if (error) return NextResponse.json({ fout: "server" }, { status: 500 });

  const { ctx } = await laadMailInstellingen(restaurant.id);
  let verstuurd = 0;
  for (const r of data ?? []) if (await stuurHerinnering(r, ctx)) verstuurd++;
  return NextResponse.json({ verstuurd, totaal: data?.length ?? 0 });
}
