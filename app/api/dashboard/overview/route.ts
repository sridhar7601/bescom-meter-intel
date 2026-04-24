import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const feeders = await db.feeder.count();
  const readings = await db.feederReading.findMany({ take: 2000, orderBy: { timestamp: "desc" } });
  const avgLoss =
    readings.length > 0 ? readings.reduce((s, r) => s + r.lossPct, 0) / readings.length : 0;
  const open = await db.anomaly.groupBy({
    by: ["severity"],
    where: { status: "OPEN" },
    _count: { _all: true },
  });
  const crit = open.find((o) => o.severity === "CRITICAL")?._count._all ?? 0;
  const high = open.find((o) => o.severity === "HIGH")?._count._all ?? 0;
  const anomalies = await db.anomaly.findMany({ where: { status: "OPEN" } });
  const revInr = anomalies.reduce((s, a) => s + (a.estimatedRevenueLossInr ?? 0), 0);
  const network = await db.feederReading.findMany({
    orderBy: { timestamp: "asc" },
    take: 30 * 24 * 20,
  });
  const byDay = new Map<string, { supplied: number; billed: number }>();
  for (const r of network) {
    const d = r.timestamp.toISOString().slice(0, 10);
    const z = byDay.get(d) ?? { supplied: 0, billed: 0 };
    z.supplied += r.kwhSupplied;
    z.billed += r.kwhBilled;
    byDay.set(d, z);
  }
  const suppliedVsBilled = [...byDay.entries()]
    .slice(-30)
    .map(([day, v]) => ({ day: day.slice(5), Supplied: v.supplied, Billed: v.billed }));
  const byType = await db.anomaly.groupBy({
    by: ["type"],
    where: { status: "OPEN" },
    _count: { _all: true },
  });
  const typeDonut = byType.map((t) => ({ type: t.type, count: t._count._all }));
  return NextResponse.json({
    totalFeeders: feeders,
    avgLossPct: Math.round(avgLoss * 10) / 10,
    openCritical: crit,
    openHigh: high,
    estRevenueLossCr: Math.round((revInr / 1e7) * 100) / 100,
    suppliedVsBilled,
    anomaliesByType: typeDonut,
  });
}
