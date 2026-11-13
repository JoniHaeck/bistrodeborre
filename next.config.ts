import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    // Oude URL's van vóór de routing per restaurant (Bistro de Borre was het enige restaurant).
    return [
      { source: "/reserveren", destination: "/bistro-de-borre", permanent: false },
      { source: "/reserveren/annuleren/:token", destination: "/annuleren/:token", permanent: true },
      { source: "/widget", destination: "/w/bistro-de-borre", permanent: false },
      { source: "/admin", destination: "/app", permanent: false },
      { source: "/admin/login", destination: "/login", permanent: false },
      { source: "/admin/:pad*", destination: "/app/bistro-de-borre/:pad*", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/reservatie-beheren/:token", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/annuleren/:token", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // De widget (/w/{slug}) mag overal ingebed worden; al het andere niet (clickjacking-bescherming, o.a. beheer).
      { source: "/w/:slug", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      {
        source: "/((?!w/).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
