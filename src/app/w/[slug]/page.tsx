import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FormulierLader } from "@/components/public/FormulierLader";
import { WidgetResizer } from "@/components/public/WidgetResizer";
import { publiekRestaurant } from "@/lib/server/restaurant";

export const metadata: Metadata = {
  title: "Reserveren",
  robots: { index: false },
};

/** Embedbare widget van één restaurant: /w/{slug}?kleur=%238b8a69&lettertype=Georgia,serif (overschrijft de instellingen). */
export default function WidgetPage({ params, searchParams }: PageProps<"/w/[slug]">) {
  return (
    <main className="w-full p-0">
      <WidgetResizer />
      <Suspense fallback={<p role="status">Beschikbaarheid laden…</p>}>
        <Widget params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Widget({ params, searchParams }: Pick<PageProps<"/w/[slug]">, "params" | "searchParams">) {
  await connection();
  const [{ slug }, zoek] = await Promise.all([params, searchParams]);
  const restaurant = await publiekRestaurant(slug);
  if (!restaurant) notFound();
  const eerste = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <FormulierLader restaurant={restaurant} kleur={eerste(zoek.kleur)} lettertype={eerste(zoek.lettertype)} />;
}
