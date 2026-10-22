import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { ReservatieVelden } from "@/components/admin/ReservatieVelden";
import { adminDb } from "@/lib/admin/auth";
import { LOG_LABEL, STATUSSEN, STATUS_LABEL } from "@/lib/admin/data";
import { formatDatum, formatTijdstip } from "@/lib/format";
import { bewerkReservatie, stuurHerinneringAdmin, zetStatus } from "../actions";

export const metadata: Metadata = { title: "Reservatie — Bistro de Borre" };

export default async function ReservatiePage({ params }: { params: Promise<{ id: string }> }) {
  const db = await adminDb();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [{ data: r }, { data: logs }] = await Promise.all([
    db.from("reservations").select("*").eq("id", id).single(),
    db.from("reservation_logs").select("*").eq("reservation_id", id).order("created_at", { ascending: false }),
  ]);
  if (!r) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/reservaties" className="text-sm underline">
        ← Terug naar reservaties
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">
          {r.voornaam} {r.naam}
        </h1>
        <p className="text-neutral-700">
          {formatDatum(r.datum, true)} om {r.tijdslot.slice(0, 5)} · {r.aantal_personen} personen · menu: {r.menu ? "ja" : "nee"} ·{" "}
          <strong>{STATUS_LABEL[r.status]}</strong> · bron: {r.bron}
        </p>
        <p className="text-sm text-neutral-600">
          Herinnering: {r.reminder_sent_at ? `verstuurd op ${formatTijdstip(r.reminder_sent_at)}` : "nog niet verstuurd"}
        </p>
      </div>

      <section aria-label="Status en acties" className="rounded-lg border border-neutral-300 bg-white p-4">
        <h2 className="font-semibold">Status</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {STATUSSEN.filter((s) => s !== r.status).map((s) => (
            <ActieFormulier key={s} action={zetStatus.bind(null, r.id, s)}>
              <button type="submit" className={s === "geannuleerd" ? "btn" : "btn-sec"}>
                {s === "geannuleerd" ? "Annuleren" : `Markeer als ${STATUS_LABEL[s].toLowerCase()}`}
              </button>
            </ActieFormulier>
          ))}
        </div>
        {r.status !== "geannuleerd" && (
          <ActieFormulier action={stuurHerinneringAdmin.bind(null, r.id)} className="mt-4">
            <button type="submit" className="btn-sec">
              {r.reminder_sent_at ? "Herinnering opnieuw versturen" : "Herinnering versturen"}
            </button>
          </ActieFormulier>
        )}
      </section>

      <section id="bewerken" aria-label="Reservatie bewerken" className="scroll-mt-4 rounded-lg border border-neutral-300 bg-white p-4">
        <h2 className="mb-3 font-semibold">Bewerken</h2>
        <ActieFormulier action={bewerkReservatie.bind(null, r.id)}>
          <ReservatieVelden w={r} />
          <button type="submit" className="btn mt-4">
            Wijzigingen opslaan
          </button>
        </ActieFormulier>
      </section>

      <section aria-label="Logboek">
        <h2 className="font-semibold">Logboek</h2>
        <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-300 bg-white text-sm">
          {(logs ?? []).map((l) => {
            const details = l.details as Record<string, unknown> | null;
            const extra =
              details && typeof details.aan === "string"
                ? `${details.aan}${typeof details.fout === "string" ? ` — ${details.fout}` : ""}`
                : null;
            return (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  {LOG_LABEL[l.actie] ?? l.actie}
                  {extra && <span className="text-neutral-600"> ({extra})</span>}
                </span>
                <span className="text-neutral-600">{formatTijdstip(l.created_at)}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
