import type { Metadata } from "next";
import { logout } from "@/app/login/actions";

export const metadata: Metadata = { title: "Geen toegang", robots: { index: false } };

/** Ingelogd, maar zonder toegang tot dit restaurant (geen lidmaatschap en geen superadmin). */
export default function GeenToegangPage() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold">Geen toegang</h1>
      <p className="mt-4">Dit account heeft geen toegang tot het beheer van dit restaurant.</p>
      <form action={logout} className="mt-6">
        <button type="submit" className="btn">
          Uitloggen
        </button>
      </form>
    </main>
  );
}
