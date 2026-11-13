import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotificatieBel } from "@/components/admin/NotificatieBel";
import { BeheerNavigatie } from "@/components/admin/BeheerNavigatie";
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
  const { count, error: aanvraagFout } = await db.from("groepsaanvragen").select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurant.id).eq("status", "in_afwachting");
  if (aanvraagFout) console.error("Aantal groepsaanvragen laden mislukt", aanvraagFout);
  const links = [
    { href: `${basis}/dashboard`, segment: `${basis}/dashboard`, label: "Dashboard" },
    { href: `${basis}/reservaties`, segment: `${basis}/reservaties`, label: "Reservaties" },
    { href: `${basis}/groepsaanvragen`, segment: `${basis}/groepsaanvragen`, label: `Groepsaanvragen${count ? ` (${count})` : ""}` },
    { href: `${basis}/dag/${vandaag}`, segment: `${basis}/dag`, label: "Dagoverzicht" },
    { href: `${basis}/shiften`, segment: `${basis}/shiften`, label: "Shiften" },
    { href: `${basis}/instellingen`, segment: `${basis}/instellingen`, label: "Instellingen" },
  ];
  if (superadmin) links.push({ href: "/platform", segment: "/platform", label: "Platform" });
  return (
    <>
      <header className="beheer-header print:hidden">
        <div className="beheer-header-inner">
          <Link href="/app" className="beheer-brand" aria-label={`${PRODUCT_NAAM}: mijn restaurants`}>
            <span aria-hidden="true">✳</span> tafelvrij<span className="beheer-brand-dot">.</span>
          </Link>
          <div className="beheer-restaurant"><span>Werkruimte</span><strong>{restaurant.naam}</strong></div>
          <div className="beheer-header-actions">
          <NotificatieBel restaurantId={restaurant.id} tijdzone={restaurant.tijdzone} basis={basis} />
          <form action={logout}>
            <button type="submit" className="btn-sec">
              Uitloggen
            </button>
          </form>
          </div>
        </div>
        <div className="beheer-nav-wrap"><BeheerNavigatie links={links} /></div>
      </header>
      <main className="beheer-main mx-auto w-full max-w-6xl flex-1 px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </>
  );
}
