import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ReservatieFormulier } from "@/components/public/ReservatieFormulier";
import { getBeschikbareDagen } from "@/lib/availability";
import { laadAvailabilityContext, laadPubliekeInstellingen } from "@/lib/availability-data";

export const metadata: Metadata = {
  title: "Reserveren — Bistro de Borre",
};

const STANDAARD_AANTAL = 2;

export default function ReserverenPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="text-3xl font-semibold">Reserveren</h1>
      <p className="mt-2 text-neutral-700">
        Kies een tijdstip en laat weten of jullie het menu nemen. Zo weet de keuken op voorhand wat er aankomt.
      </p>
      <div className="mt-6">
        <Suspense fallback={<p role="status">Beschikbaarheid laden…</p>}>
          <Formulier />
        </Suspense>
      </div>
    </main>
  );
}

async function Formulier() {
  await connection();
  let data;
  try {
    const [ctx, instellingen] = await Promise.all([laadAvailabilityContext(), laadPubliekeInstellingen()]);
    data = { dagen: getBeschikbareDagen(STANDAARD_AANTAL, ctx), instellingen };
  } catch (e) {
    console.error("Formulier laden mislukt", e);
  }

  if (!data) {
    return (
      <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-900">
        Reserveren is momenteel niet mogelijk. Probeer het later opnieuw of bel ons.
      </p>
    );
  }

  return (
    <div style={{ "--kleur-primair": data.instellingen.widget_primaire_kleur } as React.CSSProperties}>
      <ReservatieFormulier
        initieleDagen={data.dagen}
        initieelAantal={STANDAARD_AANTAL}
        maxGroepsgrootte={data.instellingen.max_groepsgrootte}
        menuLink={data.instellingen.menu_link}
      />
    </div>
  );
}
