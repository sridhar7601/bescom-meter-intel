import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const f = await db.feeder.findUnique({
    where: { id },
    include: { substation: true, _count: { select: { consumers: true, anomalies: true } } },
  });
  if (!f) return NextResponse.json({ error: "not found" }, { status: 404 });
  const series = await db.feederReading.findMany({
    where: { feederId: id },
    orderBy: { timestamp: "asc" },
    take: 720,
  });
  return NextResponse.json({
    feeder: {
      id: f.id,
      code: f.code,
      name: f.name,
      type: f.type,
      capacityKW: f.capacityKW,
      substation: f.substation,
      consumerCount: f._count.consumers,
      anomalyCount: f._count.anomalies,
    },
    series: series.map((r) => ({
      t: r.timestamp.toISOString(),
      kwhSupplied: r.kwhSupplied,
      kwhBilled: r.kwhBilled,
      lossKwh: r.lossKwh,
      lossPct: r.lossPct,
    })),
  });
}
