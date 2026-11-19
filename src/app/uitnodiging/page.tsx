import type { Metadata } from "next";
import { WachtwoordInstellen } from "./wachtwoord";

export const metadata: Metadata = { title: "Wachtwoord instellen", robots: { index: false } };

export default function UitnodigingPage() {
  return (
    <div className="beheer beheer-auth">
      <main className="beheer-auth-card">
        <p className="beheer-eyebrow">Tafelvrij</p>
        <h1>Wachtwoord instellen</h1>
        <WachtwoordInstellen />
      </main>
    </div>
  );
}
