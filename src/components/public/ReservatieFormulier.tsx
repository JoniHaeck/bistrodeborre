"use client";

import { useRef, useState } from "react";
import { formatDatum } from "@/lib/format";

type SlotInfo = { tijdslot: string; shift: string };
type Bevestiging = { datum: string; tijdslot: string; aantal: number; menu: boolean; voornaam: string };

type Props = {
  initieleDagen: string[];
  initieelAantal: number;
  maxGroepsgrootte: number;
  menuLink: string | null;
};

const veldKlasse =
  "mt-1 block w-full rounded-md border border-neutral-400 bg-white px-3 py-2 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kleur-primair)]";
const labelKlasse = "block text-sm font-medium text-neutral-900";

export function ReservatieFormulier({ initieleDagen, initieelAantal, maxGroepsgrootte, menuLink }: Props) {
  const [aantal, setAantal] = useState(initieelAantal);
  const [dagen, setDagen] = useState(initieleDagen);
  const [datum, setDatum] = useState("");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [tijdslot, setTijdslot] = useState("");
  const [laden, setLaden] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fouten, setFouten] = useState<Record<string, string>>({});
  const [melding, setMelding] = useState("");
  const [klaar, setKlaar] = useState<Bevestiging | null>(null);
  const aanvraag = useRef(0);

  async function laadSlots(nieuwAantal: number, nieuweDatum: string) {
    const id = ++aanvraag.current;
    setLaden(true);
    try {
      const res = await fetch(`/api/availability?aantal=${nieuwAantal}&datum=${nieuweDatum}`);
      const json = await res.json();
      if (id !== aanvraag.current) return;
      setSlots(res.ok ? json.slots : []);
    } finally {
      if (id === aanvraag.current) setLaden(false);
    }
  }

  async function onAantal(waarde: number) {
    setAantal(waarde);
    setTijdslot("");
    setMelding("");
    const id = ++aanvraag.current;
    setLaden(true);
    try {
      const res = await fetch(`/api/availability?aantal=${waarde}`);
      const json = await res.json();
      if (id !== aanvraag.current) return;
      const nieuweDagen: string[] = res.ok ? json.dagen : [];
      setDagen(nieuweDagen);
      // De gekozen dag kan voor de nieuwe groepsgrootte weggevallen zijn.
      if (datum && !nieuweDagen.includes(datum)) {
        setDatum("");
        setSlots([]);
      } else if (datum) {
        const r = await fetch(`/api/availability?aantal=${waarde}&datum=${datum}`);
        const j = await r.json();
        if (id === aanvraag.current) setSlots(r.ok ? j.slots : []);
      }
    } finally {
      if (id === aanvraag.current) setLaden(false);
    }
  }

  async function onDatum(waarde: string) {
    setDatum(waarde);
    setTijdslot("");
    setMelding("");
    setSlots([]);
    if (waarde) await laadSlots(aantal, waarde);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBezig(true);
    setFouten({});
    setMelding("");

    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datum,
        tijdslot,
        aantal,
        voornaam: form.get("voornaam"),
        naam: form.get("naam"),
        email: form.get("email"),
        telefoon: form.get("telefoon"),
        opmerking: form.get("opmerking") || undefined,
        menu: form.get("menu") === "on",
        website: form.get("website") || undefined,
      }),
    }).catch(() => null);

    setBezig(false);
    if (!res) {
      setMelding("Geen verbinding. Probeer het opnieuw.");
      return;
    }
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      setKlaar(json.reservatie ?? { datum, tijdslot, aantal, menu: form.get("menu") === "on", voornaam: "" });
      return;
    }
    if (json.fout === "validatie") {
      setFouten(json.velden ?? {});
      setMelding("Controleer de gemarkeerde velden.");
      return;
    }
    setMelding(json.bericht ?? "Er ging iets mis. Probeer het opnieuw.");
    if (res.status === 409 || res.status === 422) {
      setTijdslot("");
      await laadSlots(aantal, datum);
    }
  }

  if (klaar) {
    return (
      <div role="status" className="rounded-lg border border-neutral-300 bg-white p-6">
        <h2 className="text-xl font-semibold">Bedankt{klaar.voornaam ? `, ${klaar.voornaam}` : ""}!</h2>
        <p className="mt-3">
          Uw reservatie voor <strong>{klaar.aantal} {klaar.aantal === 1 ? "persoon" : "personen"}</strong> op{" "}
          <strong>{formatDatum(klaar.datum)}</strong> om <strong>{klaar.tijdslot}</strong> is genoteerd.
          {klaar.menu ? " Jullie nemen het menu." : " Jullie kiezen à la carte."}
        </p>
        <p className="mt-3 text-sm text-neutral-700">
          U ontvangt een bevestiging per e-mail, met een link om te annuleren.
        </p>
      </div>
    );
  }

  const perShift = slots.reduce<Record<string, SlotInfo[]>>((acc, s) => {
    (acc[s.shift] ??= []).push(s);
    return acc;
  }, {});

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-busy={bezig}>
      <div aria-live="polite" className="min-h-0">
        {melding && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
            {melding}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="aantal" className={labelKlasse}>Aantal personen</label>
          <select
            id="aantal"
            value={aantal}
            onChange={(e) => onAantal(Number(e.target.value))}
            className={veldKlasse}
          >
            {Array.from({ length: maxGroepsgrootte }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-600">
            Met meer dan {maxGroepsgrootte} personen? Neem contact met ons op.
          </p>
        </div>

        <div>
          <label htmlFor="datum" className={labelKlasse}>Datum</label>
          <select
            id="datum"
            value={datum}
            onChange={(e) => onDatum(e.target.value)}
            aria-describedby={fouten.datum ? "datum-fout" : undefined}
            className={veldKlasse}
          >
            <option value="">Kies een datum…</option>
            {dagen.map((d) => (
              <option key={d} value={d}>{formatDatum(d)}</option>
            ))}
          </select>
          {dagen.length === 0 && !laden && (
            <p className="mt-1 text-xs text-neutral-700">Geen beschikbare dagen voor dit aantal personen.</p>
          )}
          {fouten.datum && <p id="datum-fout" className="mt-1 text-sm text-red-800">{fouten.datum}</p>}
        </div>
      </div>

      {datum && (
        <fieldset aria-describedby={fouten.tijdslot ? "tijd-fout" : undefined}>
          <legend className={labelKlasse}>Tijdstip</legend>
          {slots.length === 0 && !laden && (
            <p className="mt-2 text-sm text-neutral-700">Geen vrije plaatsen meer op deze dag.</p>
          )}
          {Object.entries(perShift).map(([shift, lijst]) => (
            <div key={shift} className="mt-3">
              <p className="text-sm text-neutral-700">{shift}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {lijst.map((s) => (
                  <label
                    key={s.tijdslot}
                    className="cursor-pointer rounded-md border border-neutral-400 bg-white px-3 py-2 text-sm has-[:checked]:border-[var(--kleur-primair)] has-[:checked]:bg-[var(--kleur-primair)] has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--kleur-primair)]"
                  >
                    <input
                      type="radio"
                      name="tijdslot"
                      value={s.tijdslot}
                      checked={tijdslot === s.tijdslot}
                      onChange={() => setTijdslot(s.tijdslot)}
                      className="sr-only"
                    />
                    {s.tijdslot}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {fouten.tijdslot && <p id="tijd-fout" className="mt-1 text-sm text-red-800">{fouten.tijdslot}</p>}
        </fieldset>
      )}

      {tijdslot && (
        <>
          <div className="rounded-md border border-neutral-300 bg-neutral-50 p-4">
            <label className="flex items-start gap-3">
              <input type="checkbox" name="menu" className="mt-1 h-5 w-5 accent-[var(--kleur-primair)]" />
              <span>
                <span className="font-medium">Wij nemen het menu</span>
                <span className="block text-sm text-neutral-700">
                  Geldt voor de hele tafel. Zo kan de keuken sneller bedienen.
                  {menuLink && (
                    <>
                      {" "}
                      <a href={menuLink} target="_blank" rel="noopener noreferrer" className="underline">
                        Bekijk het menu
                      </a>
                    </>
                  )}
                </span>
              </span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Veld id="voornaam" label="Voornaam" fout={fouten.voornaam} autoComplete="given-name" />
            <Veld id="naam" label="Naam" fout={fouten.naam} autoComplete="family-name" />
            <Veld id="email" label="E-mail" type="email" fout={fouten.email} autoComplete="email" />
            <Veld id="telefoon" label="Telefoon" type="tel" fout={fouten.telefoon} autoComplete="tel" />
          </div>

          <div>
            <label htmlFor="opmerking" className={labelKlasse}>
              Opmerking <span className="font-normal text-neutral-600">(optioneel)</span>
            </label>
            <textarea id="opmerking" name="opmerking" rows={3} maxLength={500} className={veldKlasse} />
            {fouten.opmerking && <p className="mt-1 text-sm text-red-800">{fouten.opmerking}</p>}
          </div>

          {/* Honeypot: verborgen voor mensen en schermlezers */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>

          <p className="text-xs text-neutral-700">
            Wij gebruiken uw gegevens enkel om uw reservatie te beheren en u daarover te contacteren
            (bevestiging en herinnering). We delen ze niet met derden en bewaren ze niet langer dan nodig.
          </p>

          <button
            type="submit"
            disabled={bezig}
            className="w-full rounded-md bg-[var(--kleur-primair)] px-4 py-3 text-base font-semibold text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kleur-primair)]"
          >
            {bezig ? "Bezig…" : "Reservatie bevestigen"}
          </button>
        </>
      )}
    </form>
  );
}

function Veld({
  id, label, type = "text", fout, autoComplete,
}: { id: string; label: string; type?: string; fout?: string; autoComplete?: string }) {
  return (
    <div>
      <label htmlFor={id} className={labelKlasse}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        required
        autoComplete={autoComplete}
        aria-invalid={fout ? true : undefined}
        aria-describedby={fout ? `${id}-fout` : undefined}
        className={veldKlasse}
      />
      {fout && <p id={`${id}-fout`} className="mt-1 text-sm text-red-800">{fout}</p>}
    </div>
  );
}
