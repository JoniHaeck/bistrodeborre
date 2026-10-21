import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Bezetting } from "@/components/admin/Bezetting";
import { adminDb } from "@/lib/admin/auth";
import { laadDagContext } from "@/lib/admin/data";
import { getSlotsVoorDatum, voegDagenToe } from "@/lib/availability";
import { formatDatum, formatTijdstip } from "@/lib/format";
import { vandaagInBrussel } from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard — Bistro de Borre" };

const TYPE_LABEL: Record<string, string> = {
  nieuwe_reservatie: "Nieuwe reservatie",
  wijziging: "Gewijzigd",
  annulering: "Geannuleerd",
};

export default async function DashboardPage() {
  await connection();
  const db = await adminDb();
  const vandaag = vandaagInBrussel();
  const dagen = [vandaag, voegDagenToe(vandaag, 1)];

  const [kaarten, meldingen] = await Promise.all([
    Promise.all(
      dagen.map(async (datum) => {
        const [ctx, res] = await Promise.all([
          laadDagContext(datum),
          db.from("reservations").select("aantal_personen, menu").eq("datum", datum).neq("status", "geannuleerd"),
        ]);
        const rijen = res.data ?? [];
        return {
          datum,
          slots: getSlotsVoorDatum(datum, ctx),
          reservaties: rijen.length,
          personen: rijen.reduce((t, r) => t + r.aantal_personen, 0),
          menus: rijen.filter((r) => r.menu).reduce((t, r) => t + r.aantal_personen, 0),
        };
      }),
    ),
    db
      .from("notifications")
      .select("id, type, gelezen, created_at, reservation_id, reservations(voornaam, naam, datum, tijdslot, aantal_personen)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link href="/admin/reservaties/nieuw" className="btn">
          Reservatie toevoegen
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {kaarten.map((k, i) => (
          <section key={k.datum} className="rounded-lg border border-neutral-300 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {i === 0 ? "Vandaag" : "Morgen"} <span className="font-normal text-neutral-600">{formatDatum(k.datum)}</span>
              </h2>
              <Link href={`/admin/dag/${k.datum}`} className="text-sm underline">
                Dagoverzicht / printen
              </Link>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Reservaties", k.reservaties],
                ["Personen", k.personen],
                ["Menu's", k.menus],
              ].map(([label, waarde]) => (
                <div key={label} className="rounded bg-neutral-100 p-2">
                  <dt className="text-xs text-neutral-700">{label}</dt>
                  <dd className="text-2xl font-semibold">{waarde}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <Bezetting slots={k.slots} />
            </div>
          </section>
        ))}
      </div>

      <section aria-labelledby="recent">
        <h2 id="recent" className="text-lg font-semibold">
          Recente meldingen
        </h2>
        <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-300 bg-white">
          {(meldingen.data ?? []).length === 0 && <li className="p-3 text-sm text-neutral-600">Nog geen meldingen.</li>}
          {(meldingen.data ?? []).map((m) => {
            const r = m.reservations as unknown as { voornaam: string; naam: string; datum: string; tijdslot: string; aantal_personen: number } | null;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <strong>{TYPE_LABEL[m.type]}</strong>
                  {r && (
                    <>
                      {": "}
                      <Link href={`/admin/reservaties/${m.reservation_id}`} className="underline">
                        {r.voornaam} {r.naam}, {r.aantal_personen} p. op {formatDatum(r.datum)} {r.tijdslot.slice(0, 5)}
                      </Link>
                    </>
                  )}
                </span>
                <span className="text-neutral-600">{formatTijdstip(m.created_at)}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
