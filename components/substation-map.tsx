"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";

const yellowIcon = L.divIcon({
  className: "custom-leaflet",
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:#eab308;border:2px solid #a16207"></div>',
  iconSize: [16, 16],
});

export type SubMapItem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  feederCount: number;
  avgLoss: number;
};

export function SubstationMap({ items, className }: { items: SubMapItem[]; className?: string }) {
  const center: [number, number] = [12.97, 77.59];
  return (
    <div className={className ?? "h-[360px] overflow-hidden rounded-lg border border-amber-200"}>
      <MapContainer center={center} zoom={11.5} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {items.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={yellowIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{s.name}</p>
                <p>Feeders: {s.feederCount}</p>
                <p>Avg loss: {s.avgLoss.toFixed(1)}%</p>
                <Link className="text-amber-700 underline" href={`/substations/${s.id}`}>
                  Open
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
