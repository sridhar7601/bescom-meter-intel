import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const a = await db.anomaly.findUnique({
    where: { id },
    include: {
      consumer: true,
      feeder: { include: { substation: true } },
    },
  });
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(a);
}
