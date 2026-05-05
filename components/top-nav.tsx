"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, Map as MapIcon, AlertTriangle, TrendingUp } from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/forecasting", label: "Forecasting", icon: TrendingUp },
  { href: "/anomalies", label: "Anomalies", icon: AlertTriangle },
  { href: "/map", label: "Map", icon: MapIcon },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow-sm shadow-amber-500/30">
            <Activity className="text-white" size={20} />
          </div>
          <div>
            <div className="font-bold text-base text-stone-900">MeterSense AI</div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500">BESCOM Smart Meter Intel</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={
                  active
                    ? "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-white shadow-sm"
                    : "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-amber-50 hover:text-amber-700 transition"
                }
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium text-emerald-700">Live</span>
        </div>
      </div>
    </header>
  );
}
