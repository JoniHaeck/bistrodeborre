import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotificatieBel } from "@/components/admin/NotificatieBel";
import { adminContext, isSuperadmin } from "@/lib/admin/auth";
import { vandaagIn } from "@/lib/time";
import { logout } from "@/app/login/actions";
import { PRODUCT_NAAM } from "@/lib/product";

export default function PanelLayout({ children, params }: LayoutProps<"/app/[slug]">) {
  return (
    <Suspense fallback={<p role="status" className="p-4">Laden…</p>}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children, params }: { children: React.ReactNode; params: LayoutProps<"/app/[slug]">["params"] }) {
  await connection();
  const { slug } = await params;
  const { db, restaurant } = await adminContext(slug);
  const superadmin = await isSuperadmin(db);
  const basis = `/app/${restaurant.slug}`;
  const vandaag = vandaagIn(restaurant.tijdzone);
  const links = [
    { href: `${basis}/dashboard`, label: "Dashboard" },
    { href: `${basis}/reservaties`, label: "Reservaties" },
    { href: `${basis}/dag/${vandaag}`, label: "Dagoverzicht" },
    { href: `${basis}/shiften`, label: "Shiften" },
    { href: `${basis}/instellingen`, label: "Instellingen" },
  ];
  return (
    <>
      <header className="border-b border-[var(--primair-rand)] bg-[var(--primair-licht)] print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/app" className="flex items-baseline gap-2 text-[var(--primair-donker)]">
            <span className="text-xl font-semibold">{restaurant.naam}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{PRODUCT_NAAM}</span>
          </Link>
          <nav aria-label="Beheer" className="flex flex-1 flex-wrap gap-x-4 gap-y-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm underline-offset-4 hover:underline">
                {l.label}
              </Link>
            ))}
            {superadmin && (
              <Link href="/platform" className="text-sm font-semibold underline-offset-4 hover:underline">
                Platform
              </Link>
            )}
          </nav>
          <NotificatieBel restaurantId={restaurant.id} tijdzone={restaurant.tijdzone} basis={basis} />
          <form action={logout}>
            <button type="submit" className="btn-sec">
              Uitloggen
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </>
  );
}
