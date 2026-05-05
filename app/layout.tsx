import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "MeterSense AI — BESCOM Smart Meter Intelligence",
  description: "Smart-meter demand forecasting + AT&C loss detection + explainable tampering alerts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <TopNav />
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-6 py-6 text-xs text-stone-500">
          MeterSense AI · BESCOM Smart Meter Intelligence · PanIIT AI for Bharat 2026
        </footer>
      </body>
    </html>
  );
}
