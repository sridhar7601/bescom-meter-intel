import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { FeederTabs } from "@/components/feeder-tabs";

type Params = { params: Promise<{ id: string }> };

export default async function FeederPage({ params }: Params) {
  const { id } = await params;
  const f = await db.feeder.findUnique({
    where: { id },
    include: { substation: true },
  });
  if (!f) notFound();
  const series = await db.feederReading.findMany({
    where: { feederId: id },
    orderBy: { timestamp: "asc" },
  });
  const consumers = await db.consumer.findMany({ where: { feederId: id }, orderBy: { rrNumber: "asc" } });
  const anomalies = await db.anomaly.findMany({
    where: { feederId: id },
    orderBy: { detectedAt: "desc" },
  });
  const lastRow = series[series.length - 1];
  const meanLoss = series.length
    ? series.reduce((s, r) => s + r.lossPct, 0) / series.length
    : 0;
  const technical = Math.min(12, meanLoss * 0.35);
  const commercial = Math.max(0, meanLoss - technical);
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        <Link className="text-amber-800 underline" href={`/substations/${f.substationId}`}>
          {f.substation.name}
        </Link>
      </p>
      <h1 className="text-3xl font-bold text-amber-900">
        {f.code} — {f.name}
      </h1>
      <p className="text-stone-600">
        {f.type} · {f.capacityKW.toFixed(0)} kW design · trailing loss {lastRow?.lossPct.toFixed(1) ?? 0}%
      </p>
      <FeederTabs
        feederId={f.id}
        lineData={series.map((r) => ({
          t: r.timestamp.toISOString(),
          kwhSupplied: r.kwhSupplied,
          kwhBilled: r.kwhBilled,
          lossPct: r.lossPct,
        }))}
        breakdown={{
          technicalLossPct: Math.round(technical * 10) / 10,
          commercialLossPct: Math.round(commercial * 10) / 10,
          atcLossPct: Math.round(meanLoss * 10) / 10,
        }}
        consumers={consumers.map((c) => ({
          id: c.id,
          rrNumber: c.rrNumber,
          name: c.name,
          type: c.type,
          sanctionedLoad: c.sanctionedLoad,
          pincode: c.pincode,
        }))}
        readings={series.slice(-200).map((r) => ({
          t: r.timestamp.toISOString(),
          kwhSupplied: r.kwhSupplied,
          kwhBilled: r.kwhBilled,
          lossKwh: r.lossKwh,
          lossPct: r.lossPct,
        }))}
        anomalies={anomalies.map((a) => ({
          id: a.id,
          type: a.type,
          severity: a.severity,
          status: a.status,
          detectedAt: a.detectedAt.toISOString(),
        }))}
      />
    </div>
  );
}
