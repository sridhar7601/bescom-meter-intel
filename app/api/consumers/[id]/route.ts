import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const c = await db.consumer.findUnique({
    where: { id },
    include: { feeder: { include: { substation: true } } },
  });
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  const history = await db.consumerReading.findMany({
    where: { consumerId: id },
    orderBy: { timestamp: "asc" },
    take: 500,
  });
  return NextResponse.json({ consumer: c, history });
}
