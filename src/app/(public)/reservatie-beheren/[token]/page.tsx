import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { gastKanWijzigen, laadGastReservatie } from "@/lib/server/gast-reservatie";
import { BeheerFormulier } from "@/components/public/BeheerFormulier";

export const metadata: Metadata = { title: "Uw reservatie", robots: { index: false, follow: false } };

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10"><Suspense fallback={<p>Laden…</p>}><Inhoud params={params} /></Suspense></main>;
}

async function Inhoud({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const data = await laadGastReservatie(token);
  if (!data) return <p role="alert">Deze link is ongeldig of niet meer beschikbaar.</p>;
  const r = data.reservatie;
  const wijzigbaar = r.status === "bevestigd" && gastKanWijzigen(r.datum, r.tijdslot, data.restaurant.tijdzone);
  return <BeheerFormulier token={token} restaurant={data.restaurant.naam} kleur={data.settings.widget_primaire_kleur} telefoon={data.restaurant.telefoon} email={data.restaurant.email} max={data.settings.max_groepsgrootte}
    wijzigbaar={wijzigbaar} reservatie={{
      datum: r.datum, tijdslot: r.tijdslot.slice(0, 5), aantal: r.aantal_personen,
      voornaam: r.voornaam, naam: r.naam, email: r.email, telefoon: r.telefoon ?? "",
      opmerking: r.opmerking ?? "", menu: r.menu, status: r.status,
    }} />;
}
