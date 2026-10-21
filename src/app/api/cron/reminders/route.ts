import { NextResponse, type NextRequest } from "next/server";
import { verwerkHerinneringen } from "@/lib/email/reminders";

/** Vercel Cron (elk uur). Vercel stuurt automatisch `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ fout: "niet toegestaan" }, { status: 401 });
  }
  try {
    return NextResponse.json(await verwerkHerinneringen());
  } catch (e) {
    console.error("Herinneringen mislukt", e);
    return NextResponse.json({ fout: "server" }, { status: 500 });
  }
}
