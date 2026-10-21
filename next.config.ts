import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      // De widget mag overal ingebed worden; al het andere niet (clickjacking-bescherming, o.a. admin).
      { source: "/widget", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      {
        source: "/((?!widget).*)",
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
