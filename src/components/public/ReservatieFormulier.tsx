"use client";

import { useRef, useState } from "react";
import { formatDatum, formatDatumKort } from "@/lib/format";

type SlotInfo = { tijdslot: string; shift: string };
type Bevestiging = { datum: string; tijdslot: string; aantal: number; menu: boolean; voornaam: string; beheerToken?: string };

type Props = {
  slug: string;
  initieleDagen: string[];
  vandaag: string;
  initieelAantal: number;
  maxGroepsgrootte: number;
  menuLink: string | null;
};

const veldKlasse =
  "mt-1 block w-full rounded-[5px] border border-[var(--primair)] bg-white px-3 py-2 text-base text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primair)]";
const api = (slug: string) => `/api/r/${encodeURIComponent(slug)}`;
const labelKlasse = "block text-sm font-semibold text-[var(--foreground)]";

export function ReservatieFormulier({ slug, initieleDagen, vandaag, initieelAantal, maxGroepsgrootte, menuLink }: Props) {
  const [aantal, setAantal] = useState(initieelAantal);
  const [groep, setGroep] = useState(false);
  const [groepsAantal, setGroepsAantal] = useState(String(maxGroepsgrootte + 1));
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
      const res = await fetch(`${api(slug)}/availability?aantal=${nieuwAantal}&datum=${nieuweDatum}${groep ? "&groep=1" : ""}`);
      const json = await res.json();
      if (id !== aanvraag.current) return;
      if (!res.ok) throw new Error("Beschikbaarheid laden mislukt");
      setSlots(json.slots);
    } catch (error) {
      console.error("Tijdstippen laden mislukt", error);
      if (id === aanvraag.current) {
        setSlots([]);
        setMelding("De tijdstippen konden niet geladen worden. Probeer opnieuw.");
      }
    } finally {
      if (id === aanvraag.current) setLaden(false);
    }
  }

  async function onAantal(waarde: number, nieuweGroep = groep) {
    setGroep(nieuweGroep);
    if (nieuweGroep) setGroepsAantal(String(waarde));
    setAantal(waarde);
    setTijdslot("");
    setMelding("");
    setOpen(nieuweGroep ? "aantal" : "datum");
    const id = ++aanvraag.current;
    setLaden(true);
    try {
      const suffix = nieuweGroep ? "&groep=1" : "";
      const res = await fetch(`${api(slug)}/availability?aantal=${waarde}${suffix}`);
      const json = await res.json();
      if (id !== aanvraag.current) return;
      if (!res.ok) throw new Error("Beschikbare dagen laden mislukt");
      const nieuweDagen: string[] = json.dagen;
      setDagen(nieuweDagen);
      // De gekozen dag kan voor de nieuwe groepsgrootte weggevallen zijn.
      if (datum && !nieuweDagen.includes(datum)) {
        setDatum("");
        setSlots([]);
      } else if (datum) {
        const r = await fetch(`${api(slug)}/availability?aantal=${waarde}&datum=${datum}${suffix}`);
        const j = await r.json();
        if (!r.ok) throw new Error("Tijdstippen laden mislukt");
        if (id === aanvraag.current) setSlots(j.slots);
      }
    } catch (error) {
      console.error("Beschikbaarheid laden mislukt", error);
      if (id === aanvraag.current) {
        setDagen([]);
        setSlots([]);
        setMelding("De beschikbaarheid kon niet geladen worden. Probeer opnieuw.");
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

    const res = await fetch(`${api(slug)}/${groep ? "groepsaanvragen" : "reservations"}`, {
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
      <div role="status" className="rounded-[5px] bg-[var(--primair-licht)] p-6 text-center">
        <div aria-hidden="true" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primair)] text-2xl text-white">✓</div>
        <h2 className="text-2xl">{groep ? "Uw aanvraag is ontvangen" : "Uw reservatie is bevestigd"}</h2>
        <p className="mt-3">Bedankt{klaar.voornaam ? `, ${klaar.voornaam}` : ""}!</p>
        <div className="my-5 rounded bg-white p-4 text-left">
          <p><strong>{formatDatum(klaar.datum)}</strong> om <strong>{klaar.tijdslot}</strong></p>
          <p>{klaar.aantal} {klaar.aantal === 1 ? "gast" : "gasten"} · {klaar.menu ? "Menu" : "À la carte"}</p>
        </div>
        <p className="text-sm">{groep ? "Dit is nog geen reservatie. Het restaurant beoordeelt uw aanvraag; na bevestiging ontvangt u een e-mail." : "U ontvangt een bevestiging per e-mail. Wijzigen of annuleren kan tot 24 uur vooraf."}</p>
        {!groep && klaar.beheerToken && <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a className="rounded bg-[var(--primair)] px-4 py-3 font-semibold text-white" href={`/api/gast/${encodeURIComponent(klaar.beheerToken)}/agenda`} target="_blank" rel="noreferrer">Toevoegen aan agenda (.ics)</a>
          <a className="px-4 py-3 underline" href={`/reservatie-beheren/${encodeURIComponent(klaar.beheerToken)}`} target="_blank" rel="noreferrer">Reservatie beheren</a>
        </div>}
      </div>
    );
  }

  const perShift = slots.reduce<Record<string, SlotInfo[]>>((acc, s) => {
    (acc[s.shift] ??= []).push(s);
    return acc;
  }, {});
  const dagLabel = (d: string) => (d === vandaag ? "Vandaag" : null);
  const aantalLabel = `${aantal} ${aantal === 1 ? "gast" : "gasten"}`;
  const geldigGroepsAantal = !groep || (Number.isInteger(Number(groepsAantal)) && Number(groepsAantal) > maxGroepsgrootte && Number(groepsAantal) <= 100);
  const kiesKlaar = Boolean(datum && tijdslot && geldigGroepsAantal);

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
              <Keuze key={n} actief={!groep && aantal === n} onClick={() => onAantal(n, false)}>{n}</Keuze>
            ))}
          </div>
          {maxGroepsgrootte < 100 && (
            <div className="mt-3 space-y-2">
              <button type="button" className="text-sm underline" onClick={() => onAantal(groep ? initieelAantal : maxGroepsgrootte + 1, !groep)}>
                {groep ? "Terug naar gewone reservatie" : `Meer dan ${maxGroepsgrootte} gasten? Vraag een groepsreservatie aan`}
              </button>
              {groep && (
                <>
                  <label className={labelKlasse}>
                    Aantal gasten (maximaal 100)
                    <input type="number" min={maxGroepsgrootte + 1} max={100} value={groepsAantal} className={veldKlasse}
                      onChange={(e) => {
                        const waarde = e.target.value;
                        setGroepsAantal(waarde);
                        const n = Number(waarde);
                        if (Number.isInteger(n) && n > maxGroepsgrootte && n <= 100) setAantal(n);
                      }} />
                    {!geldigGroepsAantal && <span className="text-red-800">Kies een aantal tussen {maxGroepsgrootte + 1} en 100.</span>}
                  </label>
                  <p className="text-sm">Een groepsaanvraag is pas definitief na bevestiging door het restaurant.</p>
                  <button type="button" disabled={!geldigGroepsAantal || laden} className={hoofdKnop} onClick={() => setOpen("datum")}>Kies een datum</button>
                </>
              )}
            </div>
          )}
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
          {!laden && slots.length === 0 && <p className="text-sm">Geen beschikbare tijdstippen op deze dag.</p>}
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

        <div className="rounded-[5px] bg-[var(--primair-licht)] p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={menu}
              onChange={(e) => setMenu(e.target.checked)}
              className="mt-1 h-5 w-5 accent-[var(--primair)]"
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
          {groep ? "Groepsaanvraag verder invullen" : "Reserveren"}
        </button>
      </div>

      {/* Stap 2: contactgegevens */}
      <div hidden={stap !== "contact"}>
        <div className="mb-5 rounded-[5px] bg-[var(--primair-licht)] p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl">{groep ? "Uw aanvraag" : "Uw reservering"}</h2>
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
            {bezig ? "Bezig…" : groep ? "Groepsaanvraag versturen" : "Reserveren"}
          </button>
        </div>
      </div>
    </form>
  );
}

const hoofdKnop =
  "w-full rounded-[5px] bg-[var(--primair)] px-4 py-3 text-base font-semibold text-[var(--primair-tekst)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primair)]";

function Accordeon({
  id, icoon, titel, open, onToggle, uitgeschakeld, children,
}: {
  id: string; icoon: React.ReactNode; titel: string; open: boolean; onToggle: () => void;
  uitgeschakeld?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="rounded-[5px] border border-[var(--primair-rand)] bg-white">
      <button
        type="button"
        id={`${id}-knop`}
        aria-expanded={open}
        aria-controls={`${id}-paneel`}
        disabled={uitgeschakeld}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--primair)]"
      >
        {icoon}
        <span className="flex-1">{titel}</span>
        <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      <div id={`${id}-paneel`} role="region" aria-labelledby={`${id}-knop`} hidden={!open} className="border-t border-[var(--primair-rand)] p-4">
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
      className={`rounded-[5px] border px-2 py-2 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primair)] ${
        actief
          ? "border-[var(--primair)] bg-[var(--primair)] text-[var(--primair-tekst)]"
          : "border-[var(--primair-rand)] bg-white hover:bg-[var(--primair-licht)]"
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
