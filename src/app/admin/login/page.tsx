import type { Metadata } from "next";
import { Suspense } from "react";
import { ActieFormulier } from "@/components/admin/ActieFormulier";
import { login } from "./actions";

export const metadata: Metadata = { title: "Beheer — inloggen", robots: { index: false } };

export default function LoginPage({ searchParams }: { searchParams: Promise<{ volgende?: string }> }) {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold">Beheer Bistro de Borre</h1>
      <Suspense fallback={<p role="status">Laden…</p>}>
        <Formulier searchParams={searchParams} />
      </Suspense>
    </main>
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
