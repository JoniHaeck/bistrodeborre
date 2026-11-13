"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type LinkItem = { href: string; label: string; segment: string };

export function BeheerNavigatie({ links }: { links: LinkItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Beheer" className="beheer-nav">
      {links.map((link) => {
        const actief = pathname === link.segment || pathname.startsWith(`${link.segment}/`);
        return (
          <Link key={link.href} href={link.href} aria-current={actief ? "page" : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
