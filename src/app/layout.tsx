import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bistro de Borre — Reservaties",
  description: "Reserveer online een tafel bij Bistro de Borre.",
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
