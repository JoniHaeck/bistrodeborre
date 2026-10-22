import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotificatieBel } from "@/components/admin/NotificatieBel";
import { requireAdmin } from "@/lib/admin/auth";
import { vandaagInBrussel } from "@/lib/time";
import { logout } from "../login/actions";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p role="status" className="p-4">Laden…</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  await connection();
  await requireAdmin();
  const vandaag = vandaagInBrussel();
  const links = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/reservaties", label: "Reservaties" },
    { href: `/admin/dag/${vandaag}`, label: "Dagoverzicht" },
    { href: "/admin/shiften", label: "Shiften" },
    { href: "/admin/instellingen", label: "Instellingen" },
  ];
  return (
    <>
      <header className="border-b border-[#dcdcd2] bg-[#f3f3f0] print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="font-serif text-xl text-[#38372a]">Bistro de Borre</span>
          <nav aria-label="Beheer" className="flex flex-1 flex-wrap gap-x-4 gap-y-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm underline-offset-4 hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
          <NotificatieBel />
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
