import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { ingelogdeDb, isSuperadmin } from "@/lib/admin/auth";
import { laadBeheerders } from "@/lib/server/platform-beheerders";
import { formatDatum } from "@/lib/format";
import { voegBeheerderToe } from "../actions";
import { wijzigToegang, verwijderBeheerder } from "./actions";

export const metadata: Metadata = { title: "Beheerders", robots: { index: false } };

export default function Page() {
  return <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
    <Link href="/platform" className="underline">← Terug naar platform</Link>
    <h1 className="text-2xl font-semibold">Beheerders</h1>
    <Suspense fallback={<p role="status">Laden…</p>}><Inhoud /></Suspense>
  </main>;
}

async function Inhoud() {
  await connection();
  const db = await ingelogdeDb();
  if (!(await isSuperadmin(db))) notFound();
  const { data: restaurants, error } = await db.from("restaurants").select("id, naam").order("naam");
  if (error) throw error;
  const beheerders = await laadBeheerders();
  return <>
    <section className="rounded-lg border border-neutral-300 bg-white p-4">
      <h2 className="text-lg font-semibold">Beheerder toevoegen</h2>
      <p className="mt-1 text-sm">Kies een restaurant en koppel een bestaand account of nodig een nieuwe beheerder uit.</p>
      {restaurants.length === 0 && <p className="mt-2">Maak eerst een restaurant aan.</p>}
      <div className="mt-3 space-y-2">
        {restaurants.map((restaurant) => <details key={restaurant.id} className="rounded border border-neutral-200 p-3">
          <summary className="cursor-pointer font-semibold">{restaurant.naam}</summary>
          <ActieFormulier action={voegBeheerderToe.bind(null, restaurant.id)} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="lbl">E-mail<input name="email" type="email" required className="veld" /></label>
            <label className="lbl">Rol<select name="rol" defaultValue="beheerder" className="veld">
              <option value="beheerder">Beheerder</option><option value="eigenaar">Eigenaar</option>
            </select></label>
            <button type="submit" className="btn-sec">Bestaand account koppelen</button>
            <button type="submit" name="actie" value="uitnodigen" className="btn">Uitnodigen</button>
          </ActieFormulier>
        </details>)}
      </div>
    </section>
    <p className="text-sm">Blokkeren geldt per restaurant. Account verwijderen is definitief en verwijdert alle koppelingen. Platformbeheerders zijn beschermd.</p>
    {beheerders.length === 0 && <p>Er zijn nog geen restaurantbeheerders gekoppeld.</p>}
    <div className="space-y-4">
      {beheerders.map((b) => <section key={b.id} className="rounded-lg border border-neutral-300 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h2 className="text-lg font-semibold">{b.email || "E-mailadres ontbreekt"}</h2>
            <p className="text-sm text-neutral-700">
              {b.platformbeheerder ? "Platformbeheerder · " : ""}
              {b.bevestigd ? "Account bevestigd" : b.uitgenodigd ? "Uitnodiging in afwachting" : "Account niet bevestigd"}
              {" · "}Aangemaakt {formatDatum(b.aangemaakt.slice(0, 10))}
              {b.laatstIngelogd && <> · Laatste login {formatDatum(b.laatstIngelogd.slice(0, 10))}</>}
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-3">
          {b.restaurants.map((lid) => <li key={lid.restaurant_id} className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3">
            <div><strong>{lid.restaurants?.naam ?? "Onbekend restaurant"}</strong> · {lid.rol} · {lid.geblokkeerd ? "Geblokkeerd" : "Actief"}</div>
            {!b.platformbeheerder && <ActieFormulier action={wijzigToegang.bind(null, b.id, lid.restaurant_id)} bevestigLabel="Ja, blokkeren">
              <button type="submit" name="actie" value={lid.geblokkeerd ? "herstel" : "blokkeer"} className="btn-sec">{lid.geblokkeerd ? "Toegang herstellen" : "Blokkeren"}</button>
              <input type="hidden" name="actie" value={lid.geblokkeerd ? "herstel" : "blokkeer"} />
            </ActieFormulier>}
          </li>)}
        </ul>
        {!b.platformbeheerder && <details className="mt-4 border-t border-neutral-200 pt-3">
          <summary className="cursor-pointer text-red-800 underline">Account definitief verwijderen</summary>
          <ActieFormulier action={verwijderBeheerder.bind(null, b.id)} className="mt-3 space-y-2" bevestigLabel="Ja, definitief verwijderen">
            <label className="lbl">Typ {b.email} ter bevestiging<input className="veld" name="email" type="email" required autoComplete="off" /></label>
            <button type="submit" className="btn-sec">Verwijdering voorbereiden</button>
          </ActieFormulier>
        </details>}
      </section>)}
    </div>
  </>;
}
