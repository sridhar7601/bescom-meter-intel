import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeterSense AI",
  description: "BESCOM smart meter intelligence with AT&C loss detection and explainable tampering alerts.",
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/map", label: "Map" },
  { href: "/anomalies", label: "Anomalies" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-amber-50/40 text-stone-900">
        <header className="sticky top-0 z-20 border-b border-amber-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div>
              <h1 className="text-2xl font-bold text-amber-700">MeterSense AI</h1>
              <p className="text-sm text-amber-900/80">
                BESCOM AT&amp;C loss detection — isolation forest + feeder reconciliation
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
