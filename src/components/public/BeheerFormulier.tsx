"use client";

import { useRef, useState, type CSSProperties } from "react";
import { formatDatum } from "@/lib/format";

type Gegevens = {
  datum: string; tijdslot: string; aantal: number; voornaam: string; naam: string;
  email: string; telefoon: string; opmerking: string; menu: boolean; status: string;
};
type Slot = { tijdslot: string; shift: string };
const veld = "mt-1 w-full rounded border border-stone-400 bg-white px-3 py-2";
const knop = "inline-block rounded bg-[var(--primair)] px-4 py-3 font-semibold text-white";

export function BeheerFormulier({ token, restaurant, kleur, telefoon, email, max, wijzigbaar, reservatie }: {
  token: string; restaurant: string; kleur: string; telefoon: string | null; email: string | null; max: number; wijzigbaar: boolean; reservatie: Gegevens;
}) {
  const [gegevens, setGegevens] = useState(reservatie);
  const [opgeslagen, setOpgeslagen] = useState(reservatie);
  const [magWijzigen, setMagWijzigen] = useState(wijzigbaar);
  const aanvraag = useRef(0);
  const [bewerken, setBewerken] = useState(false);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");
  const [fout, setFout] = useState("");
  const api = `/api/gast/${encodeURIComponent(token)}`;

  async function laadSlots(datum: string, aantal: number) {
    const id = ++aanvraag.current;
    setSlots(null);
    setFout("");
    try {
      const antwoord = await fetch(`${api}?datum=${encodeURIComponent(datum)}&aantal=${aantal}`, { cache: "no-store" });
      const json = await antwoord.json();
      if (id !== aanvraag.current) return;
      if (!antwoord.ok) throw new Error(json.fout || "Tijdstippen laden mislukt.");
      setSlots(json.slots);
    } catch (error) {
      if (id !== aanvraag.current) return;
      setFout(error instanceof Error ? error.message : "Tijdstippen laden mislukt.");
    }
  }

  async function verzend(actie: "wijzig" | "annuleer") {
    if (actie === "annuleer" && !window.confirm("Wilt u deze reservatie annuleren?")) return;
    setBezig(true); setFout(""); setMelding("");
    try {
      const antwoord = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...gegevens, actie }) });
      const json = await antwoord.json();
      if (!antwoord.ok) throw new Error(json.fout || "De aanvraag is mislukt.");
      if (actie === "annuleer") {
        setGegevens((g) => ({ ...g, status: "geannuleerd" }));
        setMelding("Uw reservatie is geannuleerd.");
      } else {
        setOpgeslagen(gegevens);
        setMagWijzigen(json.wijzigbaar);
        setBewerken(false);
        setMelding(json.mailVerstuurd ? "Uw reservatie is aangepast. U ontvangt een bevestiging per e-mail." : "Uw reservatie is aangepast, maar de bevestigingsmail kon niet worden verstuurd. Contacteer het restaurant indien nodig.");
      }
    } catch (error) {
      setFout(error instanceof Error ? error.message : "De aanvraag is mislukt. Probeer opnieuw.");
    } finally { setBezig(false); }
  }

  const actief = magWijzigen && gegevens.status === "bevestigd";
  const stijl = /^#[0-9a-f]{6}$/i.test(kleur) ? { "--primair": kleur } as CSSProperties : undefined;
  return <div className="space-y-6" style={stijl}>
    <div><p className="text-sm uppercase tracking-wide">{restaurant}</p><h1 className="mt-2 text-3xl font-semibold">Uw reservatie</h1></div>
    {melding && <p role="status" className="rounded bg-green-50 p-4 text-green-900">{melding}</p>}
    {fout && <p role="alert" className="rounded bg-red-50 p-4 text-red-900">{fout}</p>}
    <section className="rounded border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl">{gegevens.status === "geannuleerd" ? "Geannuleerd" : "Reservatiegegevens"}</h2>
      <p className="mt-3">{formatDatum(gegevens.datum)} om {gegevens.tijdslot}</p>
      <p>{gegevens.aantal} {gegevens.aantal === 1 ? "gast" : "gasten"} · {gegevens.menu ? "Menu" : "À la carte"}</p>
      <p className="mt-3">{gegevens.voornaam} {gegevens.naam}<br />{gegevens.email}<br />{gegevens.telefoon}</p>
      {gegevens.opmerking && <p className="mt-3">Opmerking: {gegevens.opmerking}</p>}
    </section>
    {gegevens.status !== "geannuleerd" && <a className="inline-block underline" href={`${api}/agenda`}>Download voor uw agenda (.ics)</a>}
    {!actief && gegevens.status !== "geannuleerd" && <p>Online wijzigen of annuleren kan tot 24 uur vooraf en enkel voor bevestigde reservaties. Contacteer het restaurant voor hulp.{telefoon && <> <a className="underline" href={`tel:${telefoon}`}>{telefoon}</a></>}{email && <> · <a className="underline" href={`mailto:${email}`}>{email}</a></>}</p>}
    {actief && !bewerken && <div className="flex flex-wrap gap-3">
      <button className={knop} onClick={() => { setBewerken(true); void laadSlots(gegevens.datum, gegevens.aantal); }}>Reservatie aanpassen</button>
      <button className="rounded border border-red-800 px-4 py-3 text-red-800" disabled={bezig} onClick={() => void verzend("annuleer")}>Reservatie annuleren</button>
    </div>}
    {actief && bewerken && <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void verzend("wijzig"); }}>
      <h2 className="text-xl">Reservatie aanpassen</h2>
      <p className="text-sm">Voor een nieuwe boeking met meer dan {max} gasten kunt u het restaurant contacteren. Een bestaande grotere groep kunt u enkel op hetzelfde tijdstip behouden of verkleinen.</p>
      <label className="block">Aantal gasten<input className={veld} type="number" min="1" max={Math.max(max, opgeslagen.aantal)} required value={gegevens.aantal} onChange={(e) => { const aantal = Number(e.target.value); setGegevens({ ...gegevens, aantal, tijdslot: "" }); if (aantal >= 1 && aantal <= Math.max(max, opgeslagen.aantal) && gegevens.datum) void laadSlots(gegevens.datum, aantal); else { aanvraag.current++; setSlots(null); } }} /></label>
      <label className="block">Datum<input className={veld} type="date" required value={gegevens.datum} onChange={(e) => { const datum = e.target.value; setGegevens({ ...gegevens, datum, tijdslot: "" }); if (datum && gegevens.aantal >= 1 && gegevens.aantal <= Math.max(max, opgeslagen.aantal)) void laadSlots(datum, gegevens.aantal); else { aanvraag.current++; setSlots(null); } }} /></label>
      <label className="block">Tijdstip<select className={veld} required value={gegevens.tijdslot} onChange={(e) => setGegevens({ ...gegevens, tijdslot: e.target.value })}>
        <option value="">Kies een tijdstip</option>
        {slots?.map((s) => <option key={`${s.shift}-${s.tijdslot}`} value={s.tijdslot}>{s.tijdslot} — {s.shift}</option>)}
      </select></label>
      {slots?.length === 0 && <p>Geen beschikbare tijdstippen op deze dag.</p>}
      {(["voornaam", "naam", "email", "telefoon"] as const).map((naam) => <label className="block" key={naam}>{({ voornaam: "Voornaam", naam: "Naam", email: "E-mail", telefoon: "Telefoon" })[naam]}<input className={veld} type={naam === "email" ? "email" : naam === "telefoon" ? "tel" : "text"} required value={gegevens[naam]} onChange={(e) => setGegevens({ ...gegevens, [naam]: e.target.value })} /></label>)}
      <label className="block">Opmerking<textarea className={veld} maxLength={500} value={gegevens.opmerking} onChange={(e) => setGegevens({ ...gegevens, opmerking: e.target.value })} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={gegevens.menu} onChange={(e) => setGegevens({ ...gegevens, menu: e.target.checked })} />Wij nemen het menu</label>
      <div className="flex flex-wrap gap-3"><button className={knop} disabled={bezig}>Wijzigingen opslaan</button><button type="button" className="underline" onClick={() => { setGegevens(opgeslagen); setBewerken(false); }}>Terug</button></div>
    </form>}
  </div>;
}
