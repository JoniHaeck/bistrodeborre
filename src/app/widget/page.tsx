import type { Metadata } from "next";
import { Suspense } from "react";
import { FormulierLader } from "@/components/public/FormulierLader";
import { WidgetResizer } from "@/components/public/WidgetResizer";

export const metadata: Metadata = {
  title: "Reserveren — Bistro de Borre",
  robots: { index: false },
};

/** Embedbare widget. Query: ?kleur=%238b8a69&lettertype=Georgia,serif (overschrijft de instellingen). */
export default function WidgetPage({ searchParams }: PageProps<"/widget">) {
  return (
    <main className="w-full p-0">
      <WidgetResizer />
      <Suspense fallback={<p role="status">Beschikbaarheid laden…</p>}>
        <Widget searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Widget({ searchParams }: { searchParams: PageProps<"/widget">["searchParams"] }) {
  const params = await searchParams;
  const eerste = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <FormulierLader kleur={eerste(params.kleur)} lettertype={eerste(params.lettertype)} />;
}
