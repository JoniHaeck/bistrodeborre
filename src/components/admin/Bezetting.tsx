import type { Slot } from "@/lib/availability";

/** Bezetting per kwartier, gegroepeerd per shift, met een balk van bezet t.o.v. capaciteit. */
export function Bezetting({ slots }: { slots: Slot[] }) {
  if (slots.length === 0) return <p className="text-sm text-neutral-600">Geen shiften op deze dag.</p>;
  const groepen = [...new Set(slots.map((s) => s.shiftNaam))];
  return (
    <div className="space-y-4">
      {groepen.map((naam) => (
        <section key={naam} aria-label={`Bezetting ${naam}`}>
          <h4 className="text-sm font-semibold">{naam}</h4>
          <ul className="mt-1 space-y-1">
            {slots
              .filter((s) => s.shiftNaam === naam)
              .map((s) => {
                const pct = s.capaciteit > 0 ? Math.min(100, Math.round((s.bezet / s.capaciteit) * 100)) : 0;
                const dicht = s.gesloten === "gesloten" || s.gesloten === "geblokkeerd";
                return (
                  <li key={s.tijdslot} className="flex items-center gap-2 text-sm">
                    <span className="w-12 tabular-nums">{s.tijdslot}</span>
                    <span
                      role="img"
                      aria-label={`${s.bezet} van ${s.capaciteit} personen`}
                      className="h-3 flex-1 overflow-hidden rounded bg-neutral-200"
                    >
                      <span
                        className={`block h-full ${pct >= 100 ? "bg-red-700" : pct >= 75 ? "bg-amber-500" : "bg-green-600"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-14 text-right tabular-nums">
                      {s.bezet}/{s.capaciteit}
                    </span>
                    {dicht && <span className="w-20 text-xs text-red-800">{s.gesloten}</span>}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
