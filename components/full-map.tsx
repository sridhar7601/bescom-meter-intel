"use client";

import "leaflet/dist/leaflet.css";
import { GeoJSON, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { useMemo } from "react";

const yellowIcon = L.divIcon({
  html: '<div style="width:18px;height:18px;border-radius:9999px;background:#facc15;border:2px solid #a16207"></div>',
  iconSize: [18, 18],
});

function lossColor(pct: number) {
  if (pct >= 25) return "#dc2626";
  if (pct >= 15) return "#f59e0b";
  return "#16a34a";
}

export function FullMap({
  substations,
  heat,
  geojson,
}: {
  substations: Array<{ id: string; name: string; lat: number; lng: number; feederCount: number; avgLoss: number }>;
  heat: Array<{ pincode: string; lossPct: number; lat: number; lng: number }>;
  geojson: object | null;
}) {
  const center: [number, number] = [12.97, 77.59];
  const style = useMemo(
    () => (feature: GeoJSON.Feature | undefined) => {
      const pc = (feature?.properties as { pincode?: string } | undefined)?.pincode;
      const row = heat.find((h) => h.pincode === pc);
      const lp = row?.lossPct ?? 0;
      return {
        fillColor: lossColor(lp),
        color: "#78350f",
        weight: 1,
        fillOpacity: 0.35,
      };
    },
    [heat]
  );
  return (
    <div className="fixed inset-0 top-[88px] z-0 md:top-[88px]">
      <MapContainer center={center} zoom={11.2} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geojson ? <GeoJSON data={geojson as never} style={style as never} /> : null}
        {substations.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={yellowIcon}>
            <Popup>
              <div>
                <p className="font-semibold">{s.name}</p>
                <p>Feeders {s.feederCount}</p>
                <p>Loss {s.avgLoss.toFixed(1)}%</p>
                <Link href={`/substations/${s.id}`} className="text-amber-800 underline">
                  Substation
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-6 left-6 rounded-md border border-amber-200 bg-white/95 p-3 text-xs shadow">
        <p className="font-semibold text-amber-900">AT&amp;C loss (pincode)</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-block h-3 w-6 rounded" style={{ background: "#16a34a" }} />
          &lt; 15%
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-3 w-6 rounded" style={{ background: "#f59e0b" }} />
          15–25%
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-3 w-6 rounded" style={{ background: "#dc2626" }} />
          &gt; 25%
        </div>
      </div>
    </div>
  );
}
