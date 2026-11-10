import type { Metadata } from "next";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { adminContext } from "@/lib/admin/auth";
import { TIJDZONES } from "@/lib/time";
import { bewaarInstellingen, bewaarLogo, verwijderLogo } from "./actions";

export const metadata: Metadata = { title: "Instellingen" };

export default async function InstellingenPage({ params }: PageProps<"/app/[slug]/instellingen">) {
  const { slug } = await params;
  const { db, restaurant } = await adminContext(slug);
  const [{ data: s }, { data: r }] = await Promise.all([
    db.from("settings").select("*").eq("restaurant_id", restaurant.id).single(),
    db.from("restaurants").select("email").eq("id", restaurant.id).single(),
  ]);
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
      <ActieFormulier action={bewaarInstellingen.bind(null, slug)} className="space-y-6">
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
            <input type="email" name="notificatie_email" defaultValue={s.notificatie_email ?? ""} className="veld" />
            <span className="mt-1 block text-xs font-normal text-neutral-600">Hier komt een melding bij elke nieuwe reservatie. Leeg = geen melding.</span>
          </label>
          <label className="lbl">
            Contactadres voor gasten
            <input type="email" name="restaurant_email" defaultValue={r?.email ?? ""} className="veld" />
            <span className="mt-1 block text-xs font-normal text-neutral-600">Als een gast op een bevestiging of herinnering antwoordt, komt dat hier terecht.</span>
          </label>
        </fieldset>

        <fieldset className="grid gap-4 rounded-lg border border-neutral-300 bg-white p-4 sm:grid-cols-2">
          <legend className="px-1 font-semibold">Weergave en widget</legend>
          <label className="lbl">
            Restaurantnaam
            <input name="restaurant_naam" defaultValue={restaurant.naam} required className="veld" />
          </label>
          <label className="lbl">
            Tijdzone
            <select name="tijdzone" defaultValue={restaurant.tijdzone} className="veld">
              {(TIJDZONES as readonly string[]).includes(restaurant.tijdzone) ? null : (
                <option value={restaurant.tijdzone}>{restaurant.tijdzone}</option>
              )}
              {TIJDZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("_", " ")}
                </option>
              ))}
            </select>
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

      <section className="space-y-3 rounded-lg border border-neutral-300 bg-white p-4">
        <h2 className="font-semibold">Logo</h2>
        <p className="text-sm text-neutral-700">
          Verschijnt op de boekingspagina en in de mails aan gasten. PNG, JPG of WebP, maximaal 800 KB. Een liggend logo werkt het best.
        </p>
        {s.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo uit Supabase Storage
          <img src={s.logo_url} alt={`Logo van ${restaurant.naam}`} className="max-h-20 max-w-60 rounded border border-neutral-200 object-contain p-2" />
        ) : (
          <p className="text-sm text-neutral-600">Nog geen logo: de naam van het restaurant wordt getoond.</p>
        )}
        <ActieFormulier action={bewaarLogo.bind(null, slug)} className="flex flex-wrap items-end gap-3">
          <label className="lbl">
            {s.logo_url ? "Ander logo kiezen" : "Logo kiezen"}
            <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required className="veld" />
          </label>
          <button type="submit" className="btn">
            Logo uploaden
          </button>
        </ActieFormulier>
        {s.logo_url && (
          <ActieFormulier action={verwijderLogo.bind(null, slug)}>
            <button type="submit" className="btn-sec">
              Logo verwijderen
            </button>
          </ActieFormulier>
        )}
      </section>
    </div>
  );
}
