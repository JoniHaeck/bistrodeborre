"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDatum, formatTijdstip } from "@/lib/format";

type Melding = {
  id: string;
  type: "nieuwe_reservatie" | "wijziging" | "annulering";
  gelezen: boolean;
  created_at: string;
  reservation_id: string | null;
  reservations: { voornaam: string; naam: string; datum: string; tijdslot: string; aantal_personen: number } | null;
};

const SELECT =
  "id, type, gelezen, created_at, reservation_id, reservations(voornaam, naam, datum, tijdslot, aantal_personen)";
const TYPE_LABEL = { nieuwe_reservatie: "Nieuwe reservatie", wijziging: "Gewijzigd", annulering: "Geannuleerd" };

function piep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio kan geblokkeerd zijn tot de gebruiker interageert.
  }
}

export function NotificatieBel() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [meldingen, setMeldingen] = useState<Melding[]>([]);
  const [open, setOpen] = useState(false);
  const [geluid, setGeluid] = useState(false);
  const [browserMelding, setBrowserMelding] = useState(false);
  const instellingen = useRef({ geluid: false, browserMelding: false });

  useEffect(() => {
    instellingen.current = { geluid, browserMelding };
  }, [geluid, browserMelding]);

  useEffect(() => {
    // Voorkeuren uit localStorage pas na de eerste render lezen (geen hydration-verschil).
    const g = localStorage.getItem("melding-geluid") === "1";
    const b = localStorage.getItem("melding-browser") === "1" && Notification.permission === "granted";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGeluid(g);
    setBrowserMelding(b);
  }, []);

  const laad = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(30);
    setMeldingen((data as unknown as Melding[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laad();
    const kanaal = supabase
      .channel("admin-meldingen")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, async (payload) => {
        const { data } = await supabase.from("notifications").select(SELECT).eq("id", payload.new.id).single();
        const melding = data as unknown as Melding | null;
        if (!melding) return;
        setMeldingen((huidig) => [melding, ...huidig.filter((m) => m.id !== melding.id)]);
        if (instellingen.current.geluid) piep();
        if (instellingen.current.browserMelding && Notification.permission === "granted") {
          const r = melding.reservations;
          new Notification(TYPE_LABEL[melding.type], {
            body: r ? `${r.voornaam} ${r.naam}, ${r.aantal_personen} p. op ${formatDatum(r.datum)} om ${r.tijdslot.slice(0, 5)}` : "",
          });
        }
        router.refresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(kanaal);
    };
  }, [supabase, laad, router]);

  const ongelezen = meldingen.filter((m) => !m.gelezen).length;

  async function markeer(id?: string) {
    const q = supabase.from("notifications").update({ gelezen: true });
    await (id ? q.eq("id", id) : q.eq("gelezen", false));
    setMeldingen((huidig) => huidig.map((m) => (!id || m.id === id ? { ...m, gelezen: true } : m)));
  }

  async function wisselBrowserMelding() {
    if (browserMelding) {
      setBrowserMelding(false);
      localStorage.setItem("melding-browser", "0");
      return;
    }
    const toestemming = await Notification.requestPermission();
    const aan = toestemming === "granted";
    setBrowserMelding(aan);
    localStorage.setItem("melding-browser", aan ? "1" : "0");
  }

  function wisselGeluid() {
    const nieuw = !geluid;
    setGeluid(nieuw);
    localStorage.setItem("melding-geluid", nieuw ? "1" : "0");
    if (nieuw) piep();
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-sec relative"
        aria-expanded={open}
        aria-controls="meldingen-paneel"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">🔔</span>
        <span className="sr-only">Meldingen, {ongelezen} ongelezen</span>
        {ongelezen > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-2 -top-2 rounded-full bg-[#7a1f2b] px-1.5 text-xs font-bold text-white"
          >
            {ongelezen}
          </span>
        )}
      </button>
      {open && (
        <div
          id="meldingen-paneel"
          className="absolute right-0 z-20 mt-2 w-80 max-w-[90vw] rounded-md border border-neutral-300 bg-white p-3 shadow-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Meldingen</h2>
            <button type="button" className="text-sm underline" onClick={() => markeer()} disabled={ongelezen === 0}>
              Alles gelezen
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={geluid} onChange={wisselGeluid} /> Geluid
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={browserMelding} onChange={wisselBrowserMelding} /> Browsermelding
            </label>
          </div>
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {meldingen.length === 0 && <li className="text-sm text-neutral-600">Nog geen meldingen.</li>}
            {meldingen.map((m) => (
              <li key={m.id} className={`rounded border p-2 text-sm ${m.gelezen ? "border-neutral-200" : "border-[#7a1f2b] bg-red-50"}`}>
                <p className="font-medium">{TYPE_LABEL[m.type]}</p>
                {m.reservations ? (
                  <Link
                    href={`/admin/reservaties/${m.reservation_id}`}
                    className="underline"
                    onClick={() => {
                      void markeer(m.id);
                      setOpen(false);
                    }}
                  >
                    {m.reservations.voornaam} {m.reservations.naam}, {m.reservations.aantal_personen} p. op{" "}
                    {formatDatum(m.reservations.datum)} {m.reservations.tijdslot.slice(0, 5)}
                  </Link>
                ) : (
                  <p>Reservatie verwijderd</p>
                )}
                <p className="text-xs text-neutral-600">{formatTijdstip(m.created_at)}</p>
                {!m.gelezen && (
                  <button type="button" className="text-xs underline" onClick={() => markeer(m.id)}>
                    Markeer als gelezen
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
