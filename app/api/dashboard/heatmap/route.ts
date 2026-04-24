import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const consumers = await db.consumer.findMany({
    select: { pincode: true, feederId: true, lat: true, lng: true },
  });
  const feederIds = [...new Set(consumers.map((c) => c.feederId))];
  const lossByFeeder = new Map<string, number>();
  for (const fid of feederIds) {
    const last = await db.feederReading.findFirst({
      where: { feederId: fid },
      orderBy: { timestamp: "desc" },
    });
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
  const items = [...byPin.entries()].map(([pincode, v]) => ({
    pincode,
    lossPct: v.n > 0 ? v.sum / v.n : 0,
    lat: v.lat,
    lng: v.lng,
  }));
  return NextResponse.json({ total: items.length, items });
}
