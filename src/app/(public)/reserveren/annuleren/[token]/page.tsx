import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { formatDatum } from "@/lib/format";
import { isInVerleden } from "@/lib/time";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { annuleerReservatie } from "./actions";

export const metadata: Metadata = {
  title: "Reservatie annuleren — Bistro de Borre",
  robots: { index: false },
};

export default function AnnulerenPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <h1 className="text-3xl font-semibold">Reservatie annuleren</h1>
      <div className="mt-6">
        <Suspense fallback={<p role="status">Laden…</p>}>
          <Inhoud params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Inhoud({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const onbekend = (
    <p role="alert">Deze annuleerlink is ongeldig of niet meer beschikbaar.</p>
  );
  if (!z.string().uuid().safeParse(token).success) return onbekend;

  const { data: r } = await createServiceRoleClient()
    .from("reservations")
    .select("datum, tijdslot, aantal_personen, menu, status, voornaam")
    .eq("cancel_token", token)
    .maybeSingle();
  if (!r) return onbekend;

  const tijd = r.tijdslot.slice(0, 5);
  const samenvatting = (
    <p>
      {r.voornaam}, uw reservatie voor <strong>{r.aantal_personen} {r.aantal_personen === 1 ? "persoon" : "personen"}</strong>{" "}
      op <strong>{formatDatum(r.datum, true)}</strong> om <strong>{tijd}</strong>.
    </p>
  );

  if (r.status === "geannuleerd") {
    return (
      <div role="status">
        {samenvatting}
        <p className="mt-3 font-medium">Deze reservatie is geannuleerd.</p>
      </div>
    );
  }
  if (isInVerleden(r.datum, tijd)) {
    return <div>{samenvatting}<p className="mt-3">Deze reservatie ligt in het verleden en kan niet meer geannuleerd worden.</p></div>;
  }

  return (
    <div>
      {samenvatting}
      <p className="mt-3">Wilt u deze reservatie annuleren?</p>
      <form action={annuleerReservatie.bind(null, token)} className="mt-4">
        <button
          type="submit"
          className="rounded-md bg-red-800 px-4 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
        >
          Ja, annuleer mijn reservatie
        </button>
      </form>
    </div>
  );
}
