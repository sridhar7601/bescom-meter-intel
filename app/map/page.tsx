import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { MapPageClient } from "@/components/map-page-client";

export default async function MapPage() {
  const geoPath = path.join(process.cwd(), "public/geo/bangalore-pincodes.json");
  const raw = await readFile(geoPath, "utf8");
  const geojson = JSON.parse(raw) as object;
  const subs = await db.substation.findMany({
    include: { _count: { select: { feeders: true } }, feeders: { include: { readings: { take: 48 } } } },
  });
  const consumers = await db.consumer.findMany({ select: { pincode: true, feederId: true, lat: true, lng: true } });
  const feederIds = [...new Set(consumers.map((c) => c.feederId))];
  const lossByFeeder = new Map<string, number>();
  for (const fid of feederIds) {
    const last = await db.feederReading.findFirst({ where: { feederId: fid }, orderBy: { timestamp: "desc" } });
    lossByFeeder.set(fid, last?.lossPct ?? 0);
  }
  const byPin = new Map<string, { sum: number; n: number; lat: number; lng: number }>();
  for (const c of consumers) {
    const lp = lossByFeeder.get(c.feederId) ?? 0;
    const cur = byPin.get(c.pincode) ?? { sum: 0, n: 0, lat: 0, lng: 0 };
    cur.sum += lp;
    cur.n += 1;
    if (c.lat && c.lng) {
      cur.lat = c.lat;
      cur.lng = c.lng;
    }
    byPin.set(c.pincode, cur);
  }
  const heat = [...byPin.entries()].map(([pincode, v]) => ({
    pincode,
    lossPct: v.n > 0 ? v.sum / v.n : 0,
    lat: v.lat,
    lng: v.lng,
  }));
  const substations = subs.map((s) => {
    const losses = s.feeders.flatMap((f) => f.readings.map((r) => r.lossPct));
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    return {
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      feederCount: s._count.feeders,
      avgLoss,
    };
  });
  return (
    <div className="relative -mx-6 h-[calc(100vh-5.5rem)] min-h-[480px]">
      <MapPageClient substations={substations} heat={heat} geojson={geojson} />
    </div>
  );
}
