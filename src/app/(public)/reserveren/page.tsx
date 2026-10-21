import type { Metadata } from "next";
import { Suspense } from "react";
import { FormulierLader } from "@/components/public/FormulierLader";

export const metadata: Metadata = {
  title: "Reserveren — Bistro de Borre",
};

export default function ReserverenPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="text-3xl font-semibold">Reserveren</h1>
      <p className="mt-2 text-neutral-700">
        Kies een tijdstip en laat weten of jullie het menu nemen. Zo weet de keuken op voorhand wat er aankomt.
      </p>
      <div className="mt-6">
        <Suspense fallback={<p role="status">Beschikbaarheid laden…</p>}>
          <FormulierLader />
        </Suspense>
      </div>
    </main>
  );
}
