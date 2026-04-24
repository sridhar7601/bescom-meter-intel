import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const rows = await db.feederReading.findMany({
    where: { feederId: id },
    orderBy: { timestamp: "desc" },
    take: 14 * 24,
  });
  if (rows.length === 0) {
    return NextResponse.json({ technicalLossPct: 0, commercialLossPct: 0, atcLossPct: 0 });
  }
  const meanLoss =
    rows.reduce((s, r) => s + (r.lossPct ?? 0), 0) / (rows.length || 1);
  const technical = Math.min(12, meanLoss * 0.35);
  const commercial = Math.max(0, meanLoss - technical);
  return NextResponse.json({
    technicalLossPct: Math.round(technical * 10) / 10,
    commercialLossPct: Math.round(commercial * 10) / 10,
    atcLossPct: Math.round(meanLoss * 10) / 10,
  });
}
