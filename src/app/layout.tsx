import type { Metadata } from "next";
import "./globals.css";
import { PRODUCT_NAAM } from "@/lib/product";

export const metadata: Metadata = {
  title: { default: PRODUCT_NAAM, template: `%s — ${PRODUCT_NAAM}` },
  description: `${PRODUCT_NAAM}: online tafelreservaties voor restaurants.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
