import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BeheerNavigatie } from "@/components/admin/BeheerNavigatie";

const { pathname } = vi.hoisted(() => ({ pathname: { value: "" } }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

const links = [
  { href: "/app/bistro/dashboard", segment: "/app/bistro/dashboard", label: "Dashboard" },
  { href: "/app/bistro/reservaties", segment: "/app/bistro/reservaties", label: "Reservaties" },
  { href: "/app/bistro/dag/2026-11-13", segment: "/app/bistro/dag", label: "Dagoverzicht" },
];

describe("Beheernavigatie", () => {
  beforeEach(() => {
    pathname.value = "";
  });

  it("markeert de juiste sectie op een onderliggende pagina", () => {
    pathname.value = "/app/bistro/reservaties/nieuw";
    const html = renderToStaticMarkup(createElement(BeheerNavigatie, { links }));
    expect(html).toMatch(/<a aria-current="page" href="\/app\/bistro\/reservaties">/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("markeert ook het dagoverzicht voor een andere datum", () => {
    pathname.value = "/app/bistro/dag/2026-11-14";
    const html = renderToStaticMarkup(createElement(BeheerNavigatie, { links }));
    expect(html).toMatch(/<a aria-current="page" href="\/app\/bistro\/dag\/2026-11-13">/);
  });

  it("ziet een gelijkend pad niet als onderdeel van een sectie", () => {
    pathname.value = "/app/bistro/reservaties-extra";
    const html = renderToStaticMarkup(createElement(BeheerNavigatie, { links }));
    expect(html).not.toContain('aria-current="page"');
  });
});
