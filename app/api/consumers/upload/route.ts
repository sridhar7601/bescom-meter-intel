import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { ok: true, message: "Stub: bulk MDAS/CSV upload would enqueue feeder + consumer kWh here." },
    { status: 202 }
  );
}
