import { connection } from "next/server";
import type { Metadata } from "next";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { adminDb } from "@/lib/admin/auth";
import { WEEKDAGEN } from "@/lib/admin/data";
import { genereerTijdsloten } from "@/lib/availability";
import { formatDatum } from "@/lib/format";
import { vandaagInBrussel } from "@/lib/time";
import { bewaarShift, maakUitzondering, verwijderShift, verwijderUitzondering } from "./actions";

export const metadata: Metadata = { title: "Shiften — Bistro de Borre" };

type ShiftRij = {
  id?: string;
  weekdag: number;
  naam: string;
  start_tijd: string;
  eind_tijd: string;
  actief: boolean;
  capaciteit_per_slot: number | null;
};

function ShiftVelden({ s }: { s: ShiftRij }) {
  return (
    <div className="grid gap-3 sm:grid-cols-5">
      <input type="hidden" name="id" value={s.id ?? ""} />
      <input type="hidden" name="weekdag" value={s.weekdag} />
      <label className="lbl">
        Naam
        <input name="naam" defaultValue={s.naam} required className="veld" />
      </label>
      <label className="lbl">
        Start
        <input type="time" name="start_tijd" step={900} defaultValue={s.start_tijd.slice(0, 5)} required className="veld" />
      </label>
      <label className="lbl">
        Einde (laatste kwartier)
        <input type="time" name="eind_tijd" step={900} defaultValue={s.eind_tijd.slice(0, 5)} required className="veld" />
      </label>
      <label className="lbl">
        Capaciteit/kwartier
        <input
          type="number"
          name="capaciteit"
          min={0}
          defaultValue={s.capaciteit_per_slot ?? ""}
          placeholder="standaard"
          className="veld"
        />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
        <input type="checkbox" name="actief" defaultChecked={s.actief} className="h-5 w-5" />
        Actief
      </label>
    </div>
  );
}

export default async function ShiftenPage() {
  await connection();
  const db = await adminDb();
  const vandaag = vandaagInBrussel();
  const [{ data: shiften }, { data: uitzonderingen }, { data: inst }] = await Promise.all([
    db.from("shift_templates").select("*").order("start_tijd"),
    db.from("date_exceptions").select("*").gte("datum", vandaag).order("datum"),
    db.from("settings").select("standaard_capaciteit, slot_minuten").eq("id", 1).single(),
  ]);
  const standaard = inst?.standaard_capaciteit ?? 8;
  const stap = inst?.slot_minuten ?? 15;
  const namen = [...new Set((shiften ?? []).map((s) => s.naam))];
  const shiftNaam = new Map((shiften ?? []).map((s) => [s.id, s.naam]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Shiften</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Vaste weekkalender. Elk kwartier toont zijn capaciteit (personen). Lege capaciteit = standaard ({standaard}).
          Wijzigingen die bestaande reservaties raken, vragen eerst een bevestiging.
        </p>
      </div>

      {WEEKDAGEN.map((dag) => {
        const dagShiften = (shiften ?? []).filter((s) => s.weekdag === dag.nr);
        return (
          <section key={dag.nr} aria-labelledby={`dag-${dag.nr}`} className="rounded-lg border border-neutral-300 bg-white p-4">
            <h2 id={`dag-${dag.nr}`} className="text-lg font-semibold">
              {dag.naam}
            </h2>
            {dagShiften.length === 0 && <p className="mt-1 text-sm text-neutral-600">Gesloten (geen shiften).</p>}
            {dagShiften.map((s) => (
              <div key={s.id} className="mt-4 border-t border-neutral-200 pt-4">
                <div className="flex flex-wrap items-start gap-3">
                  <ActieFormulier action={bewaarShift} bevestigLabel="Toch opslaan" className="flex-1">
                    <ShiftVelden s={s} />
                    <button type="submit" className="btn mt-3">
                      Opslaan
                    </button>
                  </ActieFormulier>
                  <ActieFormulier action={verwijderShift.bind(null, s.id)}>
                    <button type="submit" className="btn-sec">
                      Verwijderen
                    </button>
                  </ActieFormulier>
                </div>
                <ul
                  aria-label={`Kwartieren ${s.naam} ${dag.naam}`}
                  className={`mt-3 flex flex-wrap gap-1 ${s.actief ? "" : "opacity-40"}`}
                >
                  {genereerTijdsloten(s.start_tijd, s.eind_tijd, stap).map((t) => (
                    <li key={t} className="rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-center text-xs">
                      <span className="block font-medium tabular-nums">{t}</span>
                      <span className="block text-neutral-700">{s.capaciteit_per_slot ?? standaard} p.</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <details className="mt-4 border-t border-neutral-200 pt-3">
              <summary className="cursor-pointer text-sm font-medium">Shift toevoegen op {dag.naam.toLowerCase()}</summary>
              <ActieFormulier action={bewaarShift} className="mt-3">
                <ShiftVelden s={{ weekdag: dag.nr, naam: "", start_tijd: "18:00", eind_tijd: "20:00", actief: true, capaciteit_per_slot: null }} />
                <button type="submit" className="btn mt-3">
                  Toevoegen
                </button>
              </ActieFormulier>
            </details>
          </section>
        );
      })}

      <section aria-labelledby="uitzonderingen" className="rounded-lg border border-neutral-300 bg-white p-4">
        <h2 id="uitzonderingen" className="text-lg font-semibold">
          Uitzonderingen
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          Sluitingsdagen/vakantie, tijdelijk blokkeren van een shift of kwartieren, of een afwijkende capaciteit op een specifieke datum.
        </p>

        <ActieFormulier action={maakUitzondering} className="mt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="lbl">
              Datum
              <input type="date" name="datum" min={vandaag} required className="veld" />
            </label>
            <label className="lbl">
              Geldt voor
              <select name="shift" className="veld">
                <option value="">Hele dag</option>
                {namen.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="lbl">
              Soort
              <select name="soort" className="veld">
                <option value="gesloten">Gesloten</option>
                <option value="geblokkeerd">Tijdelijk geblokkeerd</option>
                <option value="slots">Enkele kwartieren blokkeren</option>
                <option value="capaciteit">Afwijkende capaciteit</option>
              </select>
            </label>
            <label className="lbl">
              Kwartieren (bij &quot;enkele kwartieren&quot;)
              <input name="tijdsloten" placeholder="12:00, 12:15" className="veld" />
            </label>
            <label className="lbl">
              Capaciteit (bij &quot;afwijkende capaciteit&quot;)
              <input type="number" name="capaciteit" min={0} className="veld" />
            </label>
            <label className="lbl">
              Opmerking
              <input name="opmerking" maxLength={200} className="veld" />
            </label>
          </div>
          <button type="submit" className="btn mt-3">
            Uitzondering toevoegen
          </button>
        </ActieFormulier>

        <ul className="mt-5 divide-y divide-neutral-200 text-sm">
          {(uitzonderingen ?? []).length === 0 && <li className="py-2 text-neutral-600">Geen komende uitzonderingen.</li>}
          {(uitzonderingen ?? []).map((u) => {
            const wat = [
              u.gesloten && "gesloten",
              u.geblokkeerd && "geblokkeerd",
              (u.geblokkeerde_tijdsloten ?? []).length > 0 && `kwartieren geblokkeerd: ${(u.geblokkeerde_tijdsloten ?? []).map((t) => t.slice(0, 5)).join(", ")}`,
              u.afwijkende_capaciteit !== null && `capaciteit ${u.afwijkende_capaciteit}`,
            ].filter(Boolean);
            return (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong>{formatDatum(u.datum, true)}</strong> · {u.shift_template_id ? shiftNaam.get(u.shift_template_id) : "hele dag"} ·{" "}
                  {wat.join(", ")}
                  {u.opmerking && <span className="text-neutral-600"> ({u.opmerking})</span>}
                </span>
                <ActieFormulier action={verwijderUitzondering.bind(null, u.id)}>
                  <button type="submit" className="btn-sec">
                    Verwijderen
                  </button>
                </ActieFormulier>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
