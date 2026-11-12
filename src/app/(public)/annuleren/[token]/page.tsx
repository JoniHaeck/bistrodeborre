import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

export default function AnnulerenPage({ params }: { params: Promise<{ token: string }> }) {
  return <Suspense fallback={<p>Laden…</p>}><Doorverwijzen params={params} /></Suspense>;
}

async function Doorverwijzen({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  return redirect(`/reservatie-beheren/${encodeURIComponent(token)}`);
}
