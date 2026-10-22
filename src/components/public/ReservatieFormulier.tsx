"use client";

import { useRef, useState } from "react";
import { formatDatum, formatDatumKort } from "@/lib/format";

type SlotInfo = { tijdslot: string; shift: string };
type Bevestiging = { datum: string; tijdslot: string; aantal: number; menu: boolean; voornaam: string };

type Props = {
  initieleDagen: string[];
  vandaag: string;
  initieelAantal: number;
  maxGroepsgrootte: number;
  menuLink: string | null;
};

const veldKlasse =
  "mt-1 block w-full rounded-[5px] border border-[#8b8a69] bg-white px-3 py-2 text-base text-[#404041] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kleur-primair)]";
const labelKlasse = "block text-sm font-semibold text-[#404041]";

export function ReservatieFormulier({ initieleDagen, vandaag, initieelAantal, maxGroepsgrootte, menuLink }: Props) {
  const [aantal, setAantal] = useState(initieelAantal);
  const [dagen, setDagen] = useState(initieleDagen);
  const [datum, setDatum] = useState("");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [tijdslot, setTijdslot] = useState("");
  const [menu, setMenu] = useState(false);
  const [stap, setStap] = useState<"kies" | "contact">("kies");
  const [open, setOpen] = useState<"aantal" | "datum" | "tijd" | null>("datum");
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
    setOpen("datum");
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
    setOpen("tijd");
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
        menu,
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
      setKlaar(json.reservatie ?? { datum, tijdslot, aantal, menu, voornaam: "" });
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
      setStap("kies");
      setOpen("tijd");
      await laadSlots(aantal, datum);
    }
  }

  if (klaar) {
    return (
      <div role="status" className="rounded-[5px] bg-[#f3f3f0] p-6">
        <h2 className="text-2xl">Bedankt{klaar.voornaam ? `, ${klaar.voornaam}` : ""}!</h2>
        <p className="mt-3">
          Uw reservatie voor <strong>{klaar.aantal} {klaar.aantal === 1 ? "persoon" : "personen"}</strong> op{" "}
          <strong>{formatDatum(klaar.datum)}</strong> om <strong>{klaar.tijdslot}</strong> is genoteerd.
          {klaar.menu ? " Jullie nemen het menu." : " Jullie kiezen à la carte."}
        </p>
        <p className="mt-3 text-sm">U ontvangt een bevestiging per e-mail, met een link om te annuleren.</p>
      </div>
    );
  }

  const perShift = slots.reduce<Record<string, SlotInfo[]>>((acc, s) => {
    (acc[s.shift] ??= []).push(s);
    return acc;
  }, {});
  const dagLabel = (d: string) => (d === vandaag ? "Vandaag" : null);
  const aantalLabel = `${aantal} ${aantal === 1 ? "gast" : "gasten"}`;
  const kiesKlaar = Boolean(datum && tijdslot);

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={bezig}>
      <div aria-live="polite">
        {melding && (
          <p role="alert" className="mb-4 rounded-[5px] border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
            {melding}
          </p>
        )}
      </div>

      {/* Stap 1: kiezen. Blijft gemount (enkel verborgen) zodat keuzes behouden blijven. */}
      <div hidden={stap !== "kies"} className="space-y-3">
        <Accordeon
          id="aantal"
          icoon={<IcoCouvert />}
          titel={aantalLabel}
          open={open === "aantal"}
          onToggle={() => setOpen(open === "aantal" ? null : "aantal")}
        >
          <div role="radiogroup" aria-label="Aantal personen" className="grid grid-cols-5 gap-2">
            {Array.from({ length: maxGroepsgrootte }, (_, i) => i + 1).map((n) => (
              <Keuze key={n} actief={aantal === n} onClick={() => onAantal(n)}>{n}</Keuze>
            ))}
          </div>
          <p className="mt-2 text-xs">Met meer dan {maxGroepsgrootte} personen? Neem contact met ons op.</p>
        </Accordeon>

        <Accordeon
          id="datum"
          icoon={<IcoKalender />}
          titel={datum ? formatDatumKort(datum) : "Kies een datum"}
          open={open === "datum"}
          onToggle={() => setOpen(open === "datum" ? null : "datum")}
        >
          {dagen.length === 0 && !laden ? (
            <p className="text-sm">Geen beschikbare dagen voor dit aantal personen.</p>
          ) : (
            <div role="radiogroup" aria-label="Datum" className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {dagen.map((d) => (
                <Keuze key={d} actief={datum === d} onClick={() => onDatum(d)}>
                  <span className="block">{formatDatumKort(d)}</span>
                  {dagLabel(d) && <span className="block text-xs font-normal">{dagLabel(d)}</span>}
                </Keuze>
              ))}
            </div>
          )}
          {fouten.datum && <p className="mt-1 text-sm text-red-800">{fouten.datum}</p>}
        </Accordeon>

        <Accordeon
          id="tijd"
          icoon={<IcoKlok />}
          titel={tijdslot || "Tijdstip"}
          open={open === "tijd"}
          onToggle={() => setOpen(open === "tijd" ? null : "tijd")}
          uitgeschakeld={!datum}
        >
          {laden && <p role="status" className="text-sm">Laden…</p>}
          {!laden && slots.length === 0 && <p className="text-sm">Geen vrije plaatsen meer op deze dag.</p>}
          {Object.entries(perShift).map(([shift, lijst]) => (
            <div key={shift} className="mb-3 last:mb-0">
              <p className="mb-1 text-sm font-semibold">{shift}</p>
              <div role="radiogroup" aria-label={shift} className="grid grid-cols-3 gap-2">
                {lijst.map((s) => (
                  <Keuze
                    key={s.tijdslot}
                    actief={tijdslot === s.tijdslot}
                    onClick={() => {
                      setTijdslot(s.tijdslot);
                      setOpen(null);
                    }}
                  >
                    {s.tijdslot}
                  </Keuze>
                ))}
              </div>
            </div>
          ))}
          {fouten.tijdslot && <p className="mt-1 text-sm text-red-800">{fouten.tijdslot}</p>}
        </Accordeon>

        <div className="rounded-[5px] bg-[#f3f3f0] p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={menu}
              onChange={(e) => setMenu(e.target.checked)}
              className="mt-1 h-5 w-5 accent-[var(--kleur-primair)]"
            />
            <span>
              <span className="font-semibold">Wij nemen het menu</span>
              <span className="block text-sm">
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

        <button type="button" disabled={!kiesKlaar} onClick={() => setStap("contact")} className={hoofdKnop}>
          Reserveren
        </button>
      </div>

      {/* Stap 2: contactgegevens */}
      <div hidden={stap !== "contact"}>
        <div className="mb-5 rounded-[5px] bg-[#f3f3f0] p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl">Uw reservering</h2>
            <button type="button" onClick={() => setStap("kies")} className="text-sm underline">
              wijzigen
            </button>
          </div>
          <ul className="mt-3 space-y-2 font-semibold">
            <li className="flex items-center gap-3"><IcoCouvert />{aantalLabel}</li>
            <li className="flex items-center gap-3"><IcoKalender />{datum ? formatDatumKort(datum) : ""}</li>
            <li className="flex items-center gap-3"><IcoKlok />{tijdslot}</li>
            <li className="flex items-center gap-3"><IcoMenu />{menu ? "Met menu" : "Zonder menu (à la carte)"}</li>
          </ul>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStap("kies")}
            aria-label="Terug naar uw keuze"
            className="rounded-[5px] px-2 py-1 text-2xl leading-none"
          >
            ‹
          </button>
          <h2 className="text-2xl">Contact</h2>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Veld id="voornaam" label="Voornaam" fout={fouten.voornaam} autoComplete="given-name" />
            <Veld id="naam" label="Achternaam" fout={fouten.naam} autoComplete="family-name" />
          </div>
          <Veld id="telefoon" label="Telefoon" type="tel" fout={fouten.telefoon} autoComplete="tel" placeholder="+32 470 12 34 56" />
          <Veld id="email" label="E-mail" type="email" fout={fouten.email} autoComplete="email" />

          <div>
            <label htmlFor="opmerking" className={labelKlasse}>
              Opmerkingen, allergieën of dieetwensen <span className="font-normal">(optioneel)</span>
            </label>
            <textarea id="opmerking" name="opmerking" rows={3} maxLength={500} className={veldKlasse} />
            {fouten.opmerking && <p className="mt-1 text-sm text-red-800">{fouten.opmerking}</p>}
          </div>

          {/* Honeypot: verborgen voor mensen en schermlezers */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>

          <p className="text-xs">
            Wij gebruiken uw gegevens enkel om uw reservatie te beheren en u daarover te contacteren
            (bevestiging en herinnering). We delen ze niet met derden en bewaren ze niet langer dan nodig.
          </p>

          <button type="submit" disabled={bezig} className={hoofdKnop}>
            {bezig ? "Bezig…" : "Reserveren"}
          </button>
        </div>
      </div>
    </form>
  );
}

const hoofdKnop =
  "w-full rounded-[5px] bg-[var(--kleur-primair)] px-4 py-3 text-base font-semibold text-[var(--kleur-primair-tekst,#000)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kleur-primair)]";

function Accordeon({
  id, icoon, titel, open, onToggle, uitgeschakeld, children,
}: {
  id: string; icoon: React.ReactNode; titel: string; open: boolean; onToggle: () => void;
  uitgeschakeld?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="rounded-[5px] border border-[#dcdcd2] bg-white">
      <button
        type="button"
        id={`${id}-knop`}
        aria-expanded={open}
        aria-controls={`${id}-paneel`}
        disabled={uitgeschakeld}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--kleur-primair)]"
      >
        {icoon}
        <span className="flex-1">{titel}</span>
        <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      <div id={`${id}-paneel`} role="region" aria-labelledby={`${id}-knop`} hidden={!open} className="border-t border-[#dcdcd2] p-4">
        {children}
      </div>
    </div>
  );
}

function Keuze({ actief, onClick, children }: { actief: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={actief}
      onClick={onClick}
      className={`rounded-[5px] border px-2 py-2 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kleur-primair)] ${
        actief
          ? "border-[var(--kleur-primair)] bg-[var(--kleur-primair)] text-[var(--kleur-primair-tekst,#000)]"
          : "border-[#dcdcd2] bg-white hover:bg-[#f3f3f0]"
      }`}
    >
      {children}
    </button>
  );
}

const ico = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
function IcoCouvert() { return <svg {...ico}><path d="M6 3v7a2 2 0 0 0 2 2v9M10 3v7M6 3v7M18 3c-2 1-3 4-3 7h3v11" /></svg>; }
function IcoKalender() { return <svg {...ico}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>; }
function IcoKlok() { return <svg {...ico}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>; }
function IcoMenu() { return <svg {...ico}><path d="M5 4h14v16H5zM9 9h6M9 13h6" /></svg>; }

function Veld({
  id, label, type = "text", fout, autoComplete, placeholder,
}: { id: string; label: string; type?: string; fout?: string; autoComplete?: string; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={id} className={labelKlasse}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={fout ? true : undefined}
        aria-describedby={fout ? `${id}-fout` : undefined}
        className={veldKlasse}
      />
      {fout && <p id={`${id}-fout`} className="mt-1 text-sm text-red-800">{fout}</p>}
    </div>
  );
}
