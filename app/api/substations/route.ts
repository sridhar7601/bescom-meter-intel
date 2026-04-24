import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const list = await db.substation.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { feeders: true } } },
  });
  return NextResponse.json({
    total: list.length,
    substations: list.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      division: s.division,
      lat: s.lat,
      lng: s.lng,
      feederCount: s._count.feeders,
    })),
  });
}
