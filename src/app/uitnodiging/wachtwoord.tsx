"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Database } from "@/types/database";
import { controleerWachtwoordLink } from "@/lib/wachtwoord-link";

export function WachtwoordInstellen() {
  const client = useRef<SupabaseClient<Database> | null>(null);
  const controle = useRef<Promise<boolean> | null>(null);
  const [klaar, setKlaar] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [voltooid, setVoltooid] = useState(false);

  useEffect(() => {
    let actief = true;
    function auth() {
      client.current ??= createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { isSingleton: false, auth: { detectSessionInUrl: false } },
      );
      return client.current.auth;
    }
    if (!controle.current) {
      controle.current = controleerWachtwoordLink(window.location.hash, window.sessionStorage, auth);
      window.history.replaceState(null, "", window.location.pathname);
    }
    controle.current.then((geldig) => {
      if (!actief) return;
      if (!geldig) setFout("Deze link is ongeldig of verlopen. Vraag een nieuwe uitnodiging of herstellink aan.");
      else setKlaar(true);
    }).catch((error: unknown) => {
      console.error("Wachtwoordlink controleren mislukt", error);
      if (actief) setFout("De link kon niet gecontroleerd worden. Probeer opnieuw.");
    });
    return () => { actief = false; };
  }, []);

  async function opslaan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const wachtwoord = String(form.get("wachtwoord") ?? "");
    if (wachtwoord.length < 12 || wachtwoord.length > 200) {
      setFout("Kies een wachtwoord van 12 tot 200 tekens.");
      return;
    }
    if (wachtwoord !== form.get("herhaal")) {
      setFout("De wachtwoorden komen niet overeen.");
      return;
    }
    if (!client.current) return;
    setBezig(true);
    setFout("");
    try {
      const { error } = await client.current.auth.updateUser({ password: wachtwoord });
      if (error) throw error;
    } catch (error) {
      console.error("Wachtwoord instellen mislukt", error);
      setFout("Wachtwoord instellen mislukt. Probeer opnieuw of vraag een nieuwe link aan.");
      setBezig(false);
      return;
    }
    setBezig(false);
    window.sessionStorage.removeItem("uitnodiging-gebruiker");
    window.sessionStorage.removeItem("herstel-gebruiker");
    setVoltooid(true);
  }

  if (voltooid) return <p className="mt-4">Uw wachtwoord is ingesteld. <Link className="underline" href="/app">Ga naar het beheer</Link>.</p>;
  return (
    <div className="mt-4">
      {fout && <p role="alert" className="mb-3 text-red-800">{fout}</p>}
      {klaar && (
        <form onSubmit={opslaan} className="space-y-4">
          <label className="lbl">Nieuw wachtwoord
            <input name="wachtwoord" type="password" autoComplete="new-password" minLength={12} maxLength={200} required className="veld" />
          </label>
          <label className="lbl">Herhaal wachtwoord
            <input name="herhaal" type="password" autoComplete="new-password" minLength={12} maxLength={200} required className="veld" />
          </label>
          <button type="submit" disabled={bezig} className="btn">{bezig ? "Opslaan…" : "Wachtwoord opslaan"}</button>
        </form>
      )}
      {!klaar && !fout && <p role="status">Link controleren…</p>}
      {fout && <p className="mt-3 text-sm"><Link className="underline" href="/login/wachtwoord-vergeten">Een nieuwe herstellink aanvragen</Link></p>}
    </div>
  );
}
