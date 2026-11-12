import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { ingelogdeDb, isSuperadmin } from "@/lib/admin/auth";
import { formatDatum } from "@/lib/format";
import { STANDAARD_TIJDZONE, vandaagIn } from "@/lib/time";
import { logout } from "@/app/login/actions";
import { PRODUCT_NAAM } from "@/lib/product";
import { nieuwRestaurant, voegBeheerderToe, zetRestaurantStatus } from "./actions";

export const metadata: Metadata = { title: "Platform", robots: { index: false } };

const STATUS_LABEL: Record<string, string> = {
  proef: "Proef",
  actief: "Actief",
  achterstallig: "Achterstallig",
  opgezegd: "Opgezegd",
};

/** Superadmin: overzicht van alle restaurants, nieuw restaurant aanmaken, beheerders koppelen. */
export default function PlatformPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8">
      <Suspense fallback={<p role="status">Laden…</p>}>
        <Inhoud />
      </Suspense>
    </main>
  );
}

async function Inhoud() {
  await connection();
  const db = await ingelogdeDb();
  if (!(await isSuperadmin(db))) notFound();

  const vandaag = vandaagIn(STANDAARD_TIJDZONE);
  const [{ data: restaurants }, { data: leden }, { data: komend }] = await Promise.all([
    db.from("restaurants").select("id, slug, naam, status, email, created_at").order("naam"),
    db.from("memberships").select("restaurant_id, rol, user_id"),
    db.from("reservations").select("restaurant_id").gte("datum", vandaag).neq("status", "geannuleerd"),
  ]);
  const aantalLeden = new Map<string, number>();
  for (const l of leden ?? []) aantalLeden.set(l.restaurant_id, (aantalLeden.get(l.restaurant_id) ?? 0) + 1);
  const aantalKomend = new Map<string, number>();
  for (const r of komend ?? []) aantalKomend.set(r.restaurant_id, (aantalKomend.get(r.restaurant_id) ?? 0) + 1);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{PRODUCT_NAAM}: alle restaurants</h1>
        <Link href="/platform/beheerders" className="btn-sec">Beheerders beheren</Link>
        <form action={logout}>
          <button type="submit" className="btn-sec">
            Uitloggen
          </button>
        </form>
      </div>

      <section aria-label="Restaurants" className="overflow-x-auto rounded-lg border border-neutral-300 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-50">
              <th scope="col" className="p-3">Restaurant</th>
              <th scope="col" className="p-3">Status</th>
              <th scope="col" className="p-3">Beheerders</th>
              <th scope="col" className="p-3">Komende reservaties</th>
              <th scope="col" className="p-3">Sinds</th>
              <th scope="col" className="p-3">Beheerder toevoegen</th>
            </tr>
          </thead>
          <tbody>
            {(restaurants ?? []).map((r) => (
              <tr key={r.id} className="border-b border-neutral-200 align-top">
                <td className="p-3">
                  <Link href={`/app/${r.slug}/dashboard`} className="font-semibold underline">
                    {r.naam}
                  </Link>
                  <div className="text-xs text-neutral-600">
                    <a href={`/${r.slug}`} className="underline" target="_blank" rel="noopener noreferrer">
                      /{r.slug}
                    </a>
                    {r.email ? ` · ${r.email}` : ""}
                  </div>
                </td>
                <td className="p-3">
                  <ActieFormulier action={zetRestaurantStatus.bind(null, r.id)} className="flex items-center gap-2">
                    <select name="status" defaultValue={r.status} className="veld !w-auto" aria-label={`Status van ${r.naam}`}>
                      {Object.entries(STATUS_LABEL).map(([w, l]) => (
                        <option key={w} value={w}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn-sec">
                      Opslaan
                    </button>
                  </ActieFormulier>
                </td>
                <td className="p-3 tabular-nums">{aantalLeden.get(r.id) ?? 0}</td>
                <td className="p-3 tabular-nums">{aantalKomend.get(r.id) ?? 0}</td>
                <td className="p-3">{formatDatum(r.created_at.slice(0, 10))}</td>
                <td className="p-3">
                  <ActieFormulier action={voegBeheerderToe.bind(null, r.id)} className="flex flex-wrap items-center gap-2">
                    <input name="email" type="email" required placeholder="e-mail" className="veld !w-48" aria-label={`E-mail beheerder voor ${r.naam}`} />
                    <select name="rol" defaultValue="eigenaar" className="veld !w-auto" aria-label="Rol">
                      <option value="eigenaar">Eigenaar</option>
                      <option value="beheerder">Beheerder</option>
                    </select>
                    <button type="submit" className="btn-sec">
                      Bestaand account koppelen
                    </button>
                    <button type="submit" name="actie" value="uitnodigen" className="btn">
                      Nieuw account uitnodigen / opnieuw uitnodigen
                    </button>
                  </ActieFormulier>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Nieuw restaurant" className="max-w-xl rounded-lg border border-neutral-300 bg-white p-4">
        <h2 className="text-lg font-semibold">Nieuw restaurant</h2>
        <p className="mt-1 text-sm text-neutral-700">
          Instellingen worden automatisch aangemaakt. De eigenaar stelt daarna zelf shiften en capaciteit in.
        </p>
        <ActieFormulier action={nieuwRestaurant} className="mt-4 space-y-3" bevestigLabel="Begrepen">
          <label className="lbl">
            Naam
            <input name="naam" required maxLength={100} className="veld" />
          </label>
          <label className="lbl">
            Slug (URL)
            <input name="slug" maxLength={40} pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" placeholder="leeg = op basis van de naam" className="veld" />
            <span className="mt-1 block text-xs font-normal text-neutral-600">Boekingspagina wordt /slug, beheer /app/slug.</span>
          </label>
          <label className="lbl">
            E-mail eigenaar (optioneel)
            <input name="eigenaar" type="email" maxLength={200} className="veld" />
          </label>
          <button type="submit" className="btn">
            Restaurant aanmaken
          </button>
        </ActieFormulier>
      </section>
    </>
  );
}
