type Waarden = {
  datum?: string;
  tijdslot?: string;
  aantal_personen?: number;
  voornaam?: string;
  naam?: string;
  email?: string;
  telefoon?: string | null;
  opmerking?: string | null;
  menu?: boolean;
};

export function ReservatieVelden({ w = {}, nieuw = false }: { w?: Waarden; nieuw?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="lbl">
        Datum
        <input type="date" name="datum" defaultValue={w.datum} required className="veld" />
      </label>
      <label className="lbl">
        Uur (kwartier)
        <input type="time" name="tijdslot" step={900} defaultValue={w.tijdslot?.slice(0, 5)} required className="veld" />
      </label>
      <label className="lbl">
        Aantal personen
        <input type="number" name="aantal" min={1} max={100} defaultValue={w.aantal_personen ?? 2} required className="veld" />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
        <input type="checkbox" name="menu" defaultChecked={w.menu} className="h-5 w-5" />
        Wij nemen het menu (hele tafel)
      </label>
      <label className="lbl">
        Voornaam
        <input name="voornaam" defaultValue={w.voornaam} required autoComplete="off" className="veld" />
      </label>
      <label className="lbl">
        Naam
        <input name="naam" defaultValue={w.naam} required autoComplete="off" className="veld" />
      </label>
      <label className="lbl">
        E-mail
        <input type="email" name="email" defaultValue={w.email} required autoComplete="off" className="veld" />
      </label>
      <label className="lbl">
        Telefoon
        <input type="tel" name="telefoon" defaultValue={w.telefoon ?? ""} autoComplete="off" className="veld" />
      </label>
      <label className="lbl sm:col-span-2">
        Opmerking
        <textarea name="opmerking" defaultValue={w.opmerking ?? ""} rows={2} className="veld" />
      </label>
      <div className="space-y-1 text-sm sm:col-span-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="negeer_capaciteit" className="h-4 w-4" />
          Capaciteit en sluitingen negeren
        </label>
        {nieuw && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="stuur_bevestiging" defaultChecked className="h-4 w-4" />
            Bevestigingsmail naar de gast sturen
          </label>
        )}
      </div>
    </div>
  );
}
