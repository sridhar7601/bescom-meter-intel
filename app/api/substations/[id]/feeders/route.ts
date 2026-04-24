import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const feeders = await db.feeder.findMany({
    where: { substationId: id },
    orderBy: { code: "asc" },
    include: { _count: { select: { consumers: true, anomalies: true } } },
  });
  const enriched = await Promise.all(
    feeders.map(async (f) => {
      const last = await db.feederReading.findFirst({
        where: { feederId: f.id },
        orderBy: { timestamp: "desc" },
      });
      return {
        id: f.id,
        code: f.code,
        name: f.name,
        type: f.type,
        capacityKW: f.capacityKW,
        lossPct: last?.lossPct ?? 0,
        consumerCount: f._count.consumers,
        anomalyCount: f._count.anomalies,
        lastLossKwh: last?.lossKwh ?? 0,
      };
    })
  );
  return NextResponse.json({ total: enriched.length, feeders: enriched });
}
