"use client";

import dynamic from "next/dynamic";

const FullMap = dynamic(() => import("@/components/full-map").then((m) => m.FullMap), { ssr: false });

type Props = {
  substations: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    feederCount: number;
    avgLoss: number;
  }>;
  heat: Array<{ pincode: string; lossPct: number; lat: number; lng: number }>;
  geojson: object;
};

export function MapPageClient(p: Props) {
  return <FullMap substations={p.substations} heat={p.heat} geojson={p.geojson} />;
}
