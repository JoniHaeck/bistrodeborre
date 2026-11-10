"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Database } from "@/types/database";

export function WachtwoordInstellen() {
  const client = useRef<SupabaseClient<Database> | null>(null);
  const [klaar, setKlaar] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [voltooid, setVoltooid] = useState(false);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const access_token = fragment.get("access_token");
    const refresh_token = fragment.get("refresh_token");
    let actief = true;
    async function controleer() {
      const uitnodigingId = window.sessionStorage.getItem("uitnodiging-gebruiker");
      if ((!access_token || !refresh_token || fragment.get("type") !== "invite") && !uitnodigingId) return false;
      const db = client.current ?? createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { isSingleton: false, auth: { detectSessionInUrl: false } },
      );
      client.current = db;
      if (fragment.get("type") === "invite" && access_token && refresh_token) {
        const { data, error } = await db.auth.setSession({ access_token, refresh_token });
        if (error || !data.user) return false;
        window.sessionStorage.setItem("uitnodiging-gebruiker", data.user.id);
        return true;
      }
      if (!uitnodigingId) return false;
      const { data, error } = await db.auth.getUser();
      return !error && data.user?.id === uitnodigingId;
    }
    controleer().then((geldig) => {
      if (!actief) return;
      window.history.replaceState(null, "", window.location.pathname);
      if (!geldig) setFout("Deze uitnodigingslink is ongeldig of verlopen. Vraag een nieuwe uitnodiging aan.");
      else setKlaar(true);
    }).catch((error: unknown) => {
      console.error("Uitnodiging controleren mislukt", error);
      if (actief) setFout("De uitnodiging kon niet gecontroleerd worden. Probeer opnieuw.");
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
    const { error } = await client.current.auth.updateUser({ password: wachtwoord });
    setBezig(false);
    if (error) {
      setFout("Wachtwoord instellen mislukt. Probeer opnieuw of vraag een nieuwe uitnodiging.");
      return;
    }
    window.sessionStorage.removeItem("uitnodiging-gebruiker");
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
      {!klaar && !fout && <p role="status">Uitnodiging controleren…</p>}
    </div>
  );
}
