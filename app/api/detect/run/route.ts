import { NextResponse } from "next/server";
import { runAnomalyPipeline } from "@/lib/detectors/runAll";

export async function POST() {
  const r = await runAnomalyPipeline();
  return NextResponse.json(r);
}
