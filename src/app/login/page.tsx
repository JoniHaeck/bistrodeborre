import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { PRODUCT_NAAM } from "@/lib/product";
import { login } from "./actions";

export const metadata: Metadata = { title: "Inloggen", robots: { index: false } };

export default function LoginPage({ searchParams }: { searchParams: Promise<{ volgende?: string }> }) {
  return (
    <div className="beheer beheer-auth">
      <main className="beheer-auth-card">
        <Link href="/" className="beheer-brand" aria-label={`${PRODUCT_NAAM}: naar de website`}>
          <span aria-hidden="true">✳</span> tafelvrij<span className="beheer-brand-dot">.</span>
        </Link>
        <p className="beheer-eyebrow">Welkom terug</p>
        <h1>Inloggen</h1>
        <p className="beheer-intro">Fijn dat je er bent. Log in om je restaurant te beheren.</p>
        <Suspense fallback={<p role="status">Laden…</p>}>
          <Formulier searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Formulier({ searchParams }: { searchParams: Promise<{ volgende?: string }> }) {
  const { volgende } = await searchParams;
  return (
    <ActieFormulier action={login} className="mt-6 space-y-4">
      <input type="hidden" name="volgende" value={volgende ?? ""} />
      <label className="lbl">
        E-mail
        <input name="email" type="email" autoComplete="username" required className="veld" />
      </label>
      <label className="lbl">
        Wachtwoord
        <input name="password" type="password" autoComplete="current-password" required className="veld" />
      </label>
      <button type="submit" className="btn w-full">
        Inloggen
      </button>
    </ActieFormulier>
  );
}
