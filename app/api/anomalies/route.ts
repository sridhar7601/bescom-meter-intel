import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { AnomalySeverity, AnomalyStatus, AnomalyType } from "@/lib/enums";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const u = new URL(request.url);
  const status = u.searchParams.get("status") as AnomalyStatus | null;
  const severity = u.searchParams.get("severity") as AnomalySeverity | null;
  const type = u.searchParams.get("type") as AnomalyType | null;
  const feederId = u.searchParams.get("feederId");
  const pincode = u.searchParams.get("pincode");
  const where: Prisma.AnomalyWhereInput = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (type) where.type = type;
  if (feederId) where.feederId = feederId;
  if (pincode) {
    where.consumer = { pincode };
  }
  const anomalies = await db.anomaly.findMany({
    where,
    orderBy: [{ detectedAt: "desc" }],
    take: 500,
    include: {
      consumer: { select: { id: true, name: true, pincode: true, rrNumber: true } },
      feeder: { select: { id: true, code: true, name: true } },
    },
  });
  return NextResponse.json({ total: anomalies.length, anomalies });
}
