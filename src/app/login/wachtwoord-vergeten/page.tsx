import type { Metadata } from "next";
import Link from "next/link";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { vraagHerstelAan } from "./actions";

export const metadata: Metadata = { title: "Wachtwoord vergeten", robots: { index: false } };

export default function WachtwoordVergetenPage() {
  return (
    <div className="beheer beheer-auth">
      <main className="beheer-auth-card">
        <Link href="/" className="beheer-brand" aria-label="Tafelvrij: naar de website">
          <span aria-hidden="true">✳</span> tafelvrij<span className="beheer-brand-dot">.</span>
        </Link>
        <p className="beheer-eyebrow">We helpen je verder</p>
        <h1>Wachtwoord vergeten?</h1>
        <p className="beheer-intro">Vul je e-mailadres in. Als er een account bestaat, sturen we je een herstel­link.</p>
        <ActieFormulier action={vraagHerstelAan} className="mt-6">
          <label className="lbl">E-mailadres
            <input name="email" type="email" autoComplete="email" maxLength={200} required className="veld" />
          </label>
          <button type="submit" className="btn w-full">Herstellink aanvragen</button>
        </ActieFormulier>
        <p className="mt-6 text-sm"><Link href="/login" className="underline">Terug naar inloggen</Link></p>
      </main>
    </div>
  );
}
