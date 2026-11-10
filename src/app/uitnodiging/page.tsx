import type { Metadata } from "next";
import { WachtwoordInstellen } from "./wachtwoord";

export const metadata: Metadata = { title: "Uitnodiging", robots: { index: false } };

export default function UitnodigingPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold">Wachtwoord instellen</h1>
      <WachtwoordInstellen />
    </main>
  );
}
