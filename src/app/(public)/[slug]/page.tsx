import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FormulierLader } from "@/components/public/FormulierLader";
import { publiekRestaurant } from "@/lib/server/restaurant";

export const metadata: Metadata = {
  title: "Reserveren",
};

/** Publieke boekingspagina van één restaurant: /{slug}. */
export default function ReserverenPage({ params }: PageProps<"/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Suspense fallback={<p role="status">Beschikbaarheid laden…</p>}>
        <Inhoud params={params} />
      </Suspense>
    </main>
  );
}

async function Inhoud({ params }: Pick<PageProps<"/[slug]">, "params">) {
  await connection();
  const { slug } = await params;
  const restaurant = await publiekRestaurant(slug);
  if (!restaurant) notFound();
  return (
    <>
      <h1 className="text-3xl font-semibold">Reserveren bij {restaurant.naam}</h1>
      <p className="mt-2 text-neutral-700">
        Kies een tijdstip en laat weten of jullie het menu nemen. Zo weet de keuken op voorhand wat er aankomt.
      </p>
      <div className="mt-6">
        <FormulierLader restaurant={restaurant} />
      </div>
    </>
  );
}
