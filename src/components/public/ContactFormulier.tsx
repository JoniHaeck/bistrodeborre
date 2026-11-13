"use client";

import { useState, useTransition } from "react";
import { contactActie } from "@/app/contact-actions";
import type { ContactState } from "@/lib/contact";

export function ContactFormulier() {
  const [state, setState] = useState<ContactState>({});
  const [bezig, startTransition] = useTransition();

  return <form className="tv-contact-form" onSubmit={(event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState({});
    startTransition(async () => {
      try {
        const result = await contactActie({}, data);
        setState(result);
        if (result.ok) form.reset();
      } catch (error) {
        console.error("Contactaanvraag mislukt", error);
        setState({ fout: "Versturen lukt momenteel niet. Probeer later opnieuw." });
      }
    });
  }}>
    <div className="tv-form-grid">
      <label>Je naam<input name="naam" required maxLength={100} autoComplete="name" placeholder="Voor- en achternaam" /></label>
      <label>Naam van je restaurant<input name="restaurant" required maxLength={120} autoComplete="organization" placeholder="Je restaurant" /></label>
    </div>
    <label>E-mailadres<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="jij@restaurant.be" /></label>
    <label>Waarmee kunnen we je helpen?<textarea name="bericht" required minLength={10} maxLength={3000} rows={4} placeholder="Vertel ons kort over je restaurant of stel je vraag." /></label>
    <div className="tv-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <p className="tv-form-privacy">We gebruiken je gegevens enkel om je aanvraag te beantwoorden.</p>
    <button className="tv-button tv-button-dark" disabled={bezig} type="submit">{bezig ? "Versturen…" : "Verstuur je bericht"} <span aria-hidden="true">↗</span></button>
    <div aria-live="polite">{state.fout && <p className="tv-form-error" role="alert">{state.fout}</p>}{state.ok && <p className="tv-form-success" role="status">{state.ok}</p>}</div>
  </form>;
}
