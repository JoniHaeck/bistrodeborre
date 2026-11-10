import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { Bezetting } from "@/components/admin/Bezetting";
import { DagKiezer } from "@/components/admin/DagKiezer";
import { PrintKnop } from "@/components/admin/PrintKnop";
import { adminContext } from "@/lib/admin/auth";
import { STATUS_LABEL, laadDagContext } from "@/lib/admin/data";
import { getSlotsVoorDatum, voegDagenToe } from "@/lib/availability";
import { formatDatum } from "@/lib/format";
import { stuurShiftHerinneringen } from "../../reservaties/actions";

export const metadata: Metadata = { title: "Dagoverzicht" };

export default async function DagPage({ params }: PageProps<"/app/[slug]/dag/[datum]">) {
  const { slug, datum } = await params;
  const { db, restaurant } = await adminContext(slug);
  const basis = `/app/${restaurant.slug}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || Number.isNaN(Date.parse(datum))) notFound();

  const [ctx, { data }] = await Promise.all([
    laadDagContext(db, restaurant, datum),
    db.from("reservations").select("*").eq("restaurant_id", restaurant.id).eq("datum", datum).neq("status", "geannuleerd").order("tijdslot").order("naam"),
  ]);
  const slots = getSlotsVoorDatum(datum, ctx);
  const reservaties = data ?? [];
  const shiften = [...new Map(slots.map((s) => [s.shiftId, s.shiftNaam])).entries()];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <nav aria-label="Dag kiezen" className="flex items-center gap-3">
          <Link href={`${basis}/dag/${voegDagenToe(datum, -1)}`} className="btn-sec">
            ← Vorige dag
          </Link>
          <Link href={`${basis}/dag/${voegDagenToe(datum, 1)}`} className="btn-sec">
            Volgende dag →
          </Link>
          <DagKiezer datum={datum} basis={basis} />
        </nav>
        <PrintKnop />
      </div>

      <h1 className="text-2xl font-semibold">{restaurant.naam} — {formatDatum(datum, true)}</h1>

      {shiften.length === 0 && <p>Geen shiften op deze dag.</p>}
      {shiften.map(([shiftId, naam]) => {
        const rijen = reservaties.filter((r) => r.shift_template_id === shiftId);
        const personen = rijen.reduce((t, r) => t + r.aantal_personen, 0);
        const menus = rijen.filter((r) => r.menu).reduce((t, r) => t + r.aantal_personen, 0);
        return (
          <section key={shiftId} className="break-inside-avoid">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold">{naam}</h2>
              <p className="font-medium">
                {rijen.length} reservaties · {personen} personen · <strong>{menus} menu&apos;s</strong>
              </p>
            </div>
            <table className="mt-2 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-neutral-800">
                  <th scope="col" className="py-1 pr-3">Uur</th>
                  <th scope="col" className="py-1 pr-3">Naam</th>
                  <th scope="col" className="py-1 pr-3">Pers.</th>
                  <th scope="col" className="py-1 pr-3">Menu</th>
                  <th scope="col" className="py-1 pr-3">Telefoon</th>
                  <th scope="col" className="py-1 pr-3">Opmerking</th>
                  <th scope="col" className="py-1 print:hidden"><span className="sr-only">Acties</span></th>
                </tr>
              </thead>
              <tbody>
                {rijen.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-2 text-neutral-600">Geen reservaties.</td>
                  </tr>
                )}
                {rijen.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-300 align-top">
                    <td className="py-1 pr-3 tabular-nums">{r.tijdslot.slice(0, 5)}</td>
                    <td className="py-1 pr-3">
                      <Link href={`${basis}/reservaties/${r.id}`} className="underline print:no-underline">
                        {r.voornaam} {r.naam}
                      </Link>
                      {r.status !== "bevestigd" && <span className="text-neutral-600"> ({STATUS_LABEL[r.status]})</span>}
                    </td>
                    <td className="py-1 pr-3">{r.aantal_personen}</td>
                    <td className="py-1 pr-3">{r.menu ? "MENU" : "—"}</td>
                    <td className="py-1 pr-3">{r.telefoon ?? "—"}</td>
                    <td className="py-1 pr-3">{r.opmerking ?? ""}</td>
                    <td className="py-1 print:hidden">
                      <Link href={`${basis}/reservaties/${r.id}#bewerken`} className="underline">
                        Bewerken
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rijen.length > 0 && (
              <ActieFormulier action={stuurShiftHerinneringen.bind(null, slug, datum, shiftId)} className="mt-2 print:hidden">
                <button type="submit" className="btn-sec">
                  Herinnering naar alle gasten van deze shift
                </button>
              </ActieFormulier>
            )}
          </section>
        );
      })}

      <section className="print:hidden">
        <h2 className="mb-2 text-lg font-semibold">Bezetting per kwartier</h2>
        <Bezetting slots={slots} />
      </section>
    </div>
  );
}
