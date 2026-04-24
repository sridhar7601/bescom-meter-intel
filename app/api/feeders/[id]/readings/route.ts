import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const u = new URL(request.url);
  const fromS = u.searchParams.get("from");
  const toS = u.searchParams.get("to");
  const res = (u.searchParams.get("resolution") as "hour" | "day") || "hour";
  const from = fromS ? new Date(fromS) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const to = toS ? new Date(toS) : new Date();
  const raw = await db.feederReading.findMany({
    where: { feederId: id, timestamp: { gte: from, lte: to } },
    orderBy: { timestamp: "asc" },
  });
  if (res === "day") {
    const byDay = new Map<
      string,
      { kwhSupplied: number; kwhBilled: number; lossKwh: number; t: string }
    >();
    for (const r of raw) {
      const d = r.timestamp.toISOString().slice(0, 10);
      const cur = byDay.get(d) ?? { kwhSupplied: 0, kwhBilled: 0, lossKwh: 0, t: d };
      cur.kwhSupplied += r.kwhSupplied;
      cur.kwhBilled += r.kwhBilled;
      cur.lossKwh += r.lossKwh;
      byDay.set(d, cur);
    }
    return NextResponse.json({
      total: byDay.size,
      resolution: "day",
      items: [...byDay.values()].map((x) => ({
        ...x,
        lossPct: x.kwhSupplied > 0 ? (x.lossKwh / x.kwhSupplied) * 100 : 0,
      })),
    });
  }
  return NextResponse.json({
    total: raw.length,
    resolution: "hour",
    items: raw.map((r) => ({
      t: r.timestamp.toISOString(),
      kwhSupplied: r.kwhSupplied,
      kwhBilled: r.kwhBilled,
      lossKwh: r.lossKwh,
      lossPct: r.lossPct,
    })),
  });
}
