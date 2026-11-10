import Link from "next/link";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { adminContext } from "@/lib/admin/auth";
import { formatDatum } from "@/lib/format";
import { bevestigGroep, verstuurGroepsbevestiging } from "./actions";

export default async function GroepsaanvragenPage({ params }: PageProps<"/app/[slug]/groepsaanvragen">) {
  const { slug } = await params;
  const { db, restaurant } = await adminContext(slug);
  const { data, error } = await db.from("groepsaanvragen").select("*")
    .eq("restaurant_id", restaurant.id).order("created_at", { ascending: false });
  if (error) {
    console.error("Groepsaanvragen laden mislukt", error);
    return <p role="alert">Groepsaanvragen konden niet geladen worden.</p>;
  }
  const pending = data.filter((a) => a.status === "in_afwachting");
  const bevestigd = data.filter((a) => a.status === "bevestigd");
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Groepsaanvragen</h1>
      <p>Aanvragen zijn nog geen reservatie. Na bevestiging verschijnt de groep in het dagoverzicht en ontvangt de gast een e-mail.</p>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">In afwachting ({pending.length})</h2>
        {pending.length === 0 && <p>Geen open aanvragen.</p>}
        {pending.map((a) => (
          <article key={a.id} className="space-y-2 rounded-lg border border-neutral-300 bg-white p-4">
            <h3 className="font-semibold">{a.voornaam} {a.naam} · {a.aantal_personen} personen</h3>
            <p>{formatDatum(a.datum, true)} om {a.tijdslot.slice(0, 5)} · menu: {a.menu ? "ja" : "nee"}</p>
            <p>{a.email} · {a.telefoon}</p>
            {a.opmerking && <p>Opmerking: {a.opmerking}</p>}
            <ActieFormulier action={bevestigGroep.bind(null, slug, a.id)} bevestigLabel="Toch bevestigen">
              <button type="submit" className="btn">Aanvraag bevestigen</button>
            </ActieFormulier>
          </article>
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Bevestigd ({bevestigd.length})</h2>
        {bevestigd.map((a) => (
          <article key={a.id} className="space-y-2 rounded-lg border border-neutral-300 bg-white p-4">
            <h3 className="font-semibold">{a.voornaam} {a.naam} · {a.aantal_personen} personen</h3>
            <p>{formatDatum(a.datum)} om {a.tijdslot.slice(0, 5)}</p>
            <Link href={`/app/${slug}/reservaties/${a.reservation_id}`} className="underline">Bekijk reservatie en maillogboek</Link>
            <ActieFormulier action={verstuurGroepsbevestiging.bind(null, slug, a.id)}>
              <button type="submit" className="btn-sec">Bevestigingsmail opnieuw versturen</button>
            </ActieFormulier>
          </article>
        ))}
      </section>
    </div>
  );
}
