import { NextResponse } from "next/server";
import { AnomalyStatus } from "@/lib/enums";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const valid = new Set<string>(Object.values(AnomalyStatus) as string[]);

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as { status?: string; investigator?: string; resolution?: string };
  if (!body.status || !valid.has(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const existing = await db.anomaly.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const hist = (() => {
    try {
      return JSON.parse(existing.statusHistory ?? "[]") as Array<{
        at: string;
        from: string;
        to: string;
        actor: string;
      }>;
    } catch {
      return [];
    }
  })();
  hist.push({
    at: new Date().toISOString(),
    from: existing.status,
    to: body.status,
    actor: body.investigator ?? "demo-officer",
  });
  const updated = await db.anomaly.update({
    where: { id },
    data: {
      status: body.status,
      investigator: body.investigator ?? "demo-officer",
      resolution: body.resolution,
      statusHistory: JSON.stringify(hist),
    },
  });
  return NextResponse.json(updated);
}
