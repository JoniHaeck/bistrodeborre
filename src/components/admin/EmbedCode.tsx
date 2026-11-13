"use client";

import { useState } from "react";

export function EmbedCode({ titel, uitleg, code }: { titel: string; uitleg: string; code: string }) {
  const [melding, setMelding] = useState("");

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(code);
      setMelding("Code gekopieerd.");
    } catch {
      setMelding("Kopiëren is niet gelukt. Selecteer de code en kopieer ze handmatig.");
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{titel}</h3>
      <p className="text-sm text-neutral-700">{uitleg}</p>
      <label className="lbl">
        <span className="sr-only">Embedcode: {titel}</span>
        <textarea readOnly value={code} rows={4} onFocus={(event) => event.currentTarget.select()} className="veld font-mono text-sm" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-sec" onClick={kopieer}>Code kopiëren</button>
        <span role="status" className="text-sm">{melding}</span>
      </div>
    </div>
  );
}
