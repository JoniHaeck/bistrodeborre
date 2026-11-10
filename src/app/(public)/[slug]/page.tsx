import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FormulierLader } from "@/components/public/FormulierLader";
import { PRODUCT_NAAM } from "@/lib/product";
import { laadRestaurantOpSlug, publiekRestaurant } from "@/lib/server/restaurant";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const restaurant = await laadRestaurantOpSlug((await params).slug);
  return restaurant
    ? { title: `Reserveren bij ${restaurant.naam}`, description: `Reserveer online een tafel bij ${restaurant.naam}.` }
    : { title: "Reserveren" };
}

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
      <FormulierLader restaurant={restaurant} metKop />
      <p className="mt-10 text-center text-xs text-neutral-500">Online reserveren via {PRODUCT_NAAM}</p>
    </>
  );
}
