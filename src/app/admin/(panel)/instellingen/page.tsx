import type { Metadata } from "next";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { adminDb } from "@/lib/admin/auth";
import { bewaarInstellingen } from "./actions";

export const metadata: Metadata = { title: "Instellingen — Bistro de Borre" };

export default async function InstellingenPage() {
  const db = await adminDb();
  const { data: s } = await db.from("settings").select("*").eq("id", 1).single();
  if (!s) return <p role="alert">Instellingen konden niet geladen worden.</p>;

  const getal = (naam: string, label: string, waarde: number, hint?: string) => (
    <label className="lbl">
      {label}
      <input type="number" name={naam} defaultValue={waarde} min={0} required className="veld" />
      {hint && <span className="mt-1 block text-xs font-normal text-neutral-600">{hint}</span>}
    </label>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Instellingen</h1>
      <ActieFormulier action={bewaarInstellingen} className="space-y-6">
        <fieldset className="grid gap-4 rounded-lg border border-neutral-300 bg-white p-4 sm:grid-cols-2">
          <legend className="px-1 font-semibold">Reserveren</legend>
          {getal("standaard_capaciteit", "Standaardcapaciteit per kwartier", s.standaard_capaciteit, "Personen per kwartier, tenzij een shift of uitzondering iets anders bepaalt.")}
          {getal("max_groepsgrootte", "Maximale groepsgrootte", s.max_groepsgrootte, "Grotere groepen moeten telefonisch boeken.")}
          {getal("boekingshorizon_dagen", "Boekingshorizon (dagen)", s.boekingshorizon_dagen, "Hoever vooruit gasten kunnen boeken.")}
          {getal("min_voorboekingsuren", "Minimaal vooraf boeken (uren)", s.min_voorboekingsuren, "Gasten kunnen niet boeken binnen zoveel uur voor het tijdslot. 0 = tot het laatste moment.")}
        </fieldset>

        <fieldset className="grid gap-4 rounded-lg border border-neutral-300 bg-white p-4 sm:grid-cols-2">
          <legend className="px-1 font-semibold">E-mails</legend>
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
            <input type="checkbox" name="herinneringen_actief" defaultChecked={s.herinneringen_actief} className="h-5 w-5" />
            Herinneringsmails automatisch versturen
          </label>
          {getal("herinnering_uren_vooraf", "Herinnering (uren vooraf)", s.herinnering_uren_vooraf)}
          <label className="lbl">
            Notificatie-e-mail restaurant
            <input type="email" name="notificatie_email" defaultValue={s.notificatie_email} required className="veld" />
          </label>
        </fieldset>

        <fieldset className="grid gap-4 rounded-lg border border-neutral-300 bg-white p-4 sm:grid-cols-2">
          <legend className="px-1 font-semibold">Weergave en widget</legend>
          <label className="lbl">
            Restaurantnaam
            <input name="restaurant_naam" defaultValue={s.restaurant_naam} required className="veld" />
          </label>
          <label className="lbl">
            Primaire kleur
            <input type="color" name="widget_primaire_kleur" defaultValue={s.widget_primaire_kleur} className="veld h-11 p-1" />
          </label>
          <label className="lbl">
            Lettertype
            <input name="widget_lettertype" defaultValue={s.widget_lettertype} required className="veld" />
          </label>
          <label className="lbl">
            Link naar het menu (website)
            <input type="url" name="menu_link" defaultValue={s.menu_link ?? ""} placeholder="https://…" className="veld" />
          </label>
        </fieldset>

        <button type="submit" className="btn">
          Instellingen opslaan
        </button>
      </ActieFormulier>
    </div>
  );
}
