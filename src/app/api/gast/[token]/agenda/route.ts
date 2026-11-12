import { z } from "zod";
import { laadGastReservatie } from "@/lib/server/gast-reservatie";
import { maakAgenda } from "@/lib/agenda";
const veilig = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!z.string().uuid().safeParse(token).success) return new Response("Ongeldige link", { status: 404, headers: veilig });
  try {
    const data = await laadGastReservatie(token);
    if (!data || data.reservatie.status === "geannuleerd") return new Response("Reservatie niet gevonden", { status: 404, headers: veilig });
    const r = data.reservatie;
    const inhoud = maakAgenda(r, data.restaurant.naam, data.restaurant.tijdzone, r.duur_minuten ?? data.settings.standaard_duur_minuten);
    return new Response(inhoud, { headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reservatie.ics"',
      ...veilig,
    } });
  } catch (error) {
    console.error("Agenda downloaden mislukt", error);
    return new Response("Agenda kon niet geladen worden", { status: 500, headers: veilig });
  }
}
