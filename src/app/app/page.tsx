import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ingelogdeDb, isSuperadmin } from "@/lib/admin/auth";
import { logout } from "@/app/login/actions";

export const metadata: Metadata = { title: "Mijn restaurants", robots: { index: false } };

/** Restaurantkiezer: toont de restaurants waartoe de gebruiker toegang heeft (via RLS). */
export default function AppIndex() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold">Mijn restaurants</h1>
      <Suspense fallback={<p role="status">Laden…</p>}>
        <Lijst />
      </Suspense>
    </main>
  );
}

async function Lijst() {
  await connection();
  const db = await ingelogdeDb();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error("Sessie kon niet worden gecontroleerd.");
  const [superadmin, { data: lidmaatschappen, error: lidFout }] = await Promise.all([
    isSuperadmin(db),
    db.from("memberships").select("restaurants(slug, naam)").eq("user_id", user.id).eq("geblokkeerd", false).order("created_at"),
  ]);
  if (lidFout) throw lidFout;
  const restaurants = (lidmaatschappen ?? []).flatMap((m) => (m.restaurants ? [m.restaurants] : []));

  if (superadmin && restaurants.length === 0) redirect("/platform");
  if (!superadmin && restaurants.length === 1) redirect(`/app/${restaurants[0].slug}/dashboard`);
  if (!superadmin && restaurants.length === 0) redirect("/app/geen-toegang");

  return (
    <div className="mt-6 space-y-4">
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-300 bg-white">
        {restaurants.map((r) => (
          <li key={r.slug}>
            <Link href={`/app/${r.slug}/dashboard`} className="block px-4 py-3 underline-offset-4 hover:underline">
              {r.naam}
            </Link>
          </li>
        ))}
      </ul>
      {superadmin && (
        <p>
          <Link href="/platform" className="font-semibold underline">
            Alle restaurants beheren (platform)
          </Link>
        </p>
      )}
      <form action={logout}>
        <button type="submit" className="btn-sec">
          Uitloggen
        </button>
      </form>
    </div>
  );
}
