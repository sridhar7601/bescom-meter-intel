import Link from "next/link";
import { AreaChart, Card, DonutChart, Metric, Text, Title } from "@tremor/react";
import { db } from "@/lib/db";
import { SubstationMapDynamic } from "@/components/substation-map-dynamic";
import type { SubMapItem } from "@/components/substation-map";

async function load() {
  const subs = await db.substation.findMany({
    orderBy: { name: "asc" },
    include: { feeders: { include: { readings: { orderBy: { timestamp: "desc" }, take: 24 } } } },
  });
  const mapItems: SubMapItem[] = subs.map((s) => {
    const losses = s.feeders.flatMap((f) => f.readings.map((r) => r.lossPct));
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    return {
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      feederCount: s.feeders.length,
      avgLoss,
    };
  });
  const readings = await db.feederReading.findMany({ orderBy: { timestamp: "asc" } });
  const byDay = new Map<string, { Supplied: number; Billed: number }>();
  for (const r of readings) {
    const d = r.timestamp.toISOString().slice(0, 10);
    const z = byDay.get(d) ?? { Supplied: 0, Billed: 0 };
    z.Supplied += r.kwhSupplied;
    z.Billed += r.kwhBilled;
    byDay.set(d, z);
  }
  const suppliedVsBilled = [...byDay.entries()]
    .map(([k, v]) => ({ day: k.slice(5), Supplied: v.Supplied, Billed: v.Billed }))
    .slice(-30);
  const avgLossAll =
    readings.length > 0 ? readings.reduce((s, r) => s + r.lossPct, 0) / readings.length : 0;
  const openA = await db.anomaly.findMany({ where: { status: "OPEN" } });
  const crit = openA.filter((a) => a.severity === "CRITICAL").length;
  const high = openA.filter((a) => a.severity === "HIGH").length;
  const rev = openA.reduce((s, a) => s + (a.estimatedRevenueLossInr ?? 0), 0);
  const byT = new Map<string, number>();
  for (const a of openA) byT.set(a.type, (byT.get(a.type) ?? 0) + 1);
  const typeDonut = [...byT.entries()].map(([name, value]) => ({ name, value }));
  const recent = await db.anomaly.findMany({
    where: { status: "OPEN", severity: { in: ["CRITICAL", "HIGH"] } },
    orderBy: { detectedAt: "desc" },
    take: 8,
    include: { feeder: true, consumer: true },
  });
  return {
    mapItems,
    suppliedVsBilled,
    avgLossAll,
    crit,
    high,
    rev,
    typeDonut,
    openCount: openA.length,
    feeders: await db.feeder.count(),
    recent,
  };
}

export default async function HomePage() {
  const d = await load();
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card decoration="top" decorationColor="amber">
          <Text>Active feeders</Text>
          <Metric>{d.feeders}</Metric>
        </Card>
        <Card decoration="top" decorationColor="yellow">
          <Text>Avg network loss</Text>
          <Metric>{(d.avgLossAll ?? 0).toFixed(1)}%</Metric>
        </Card>
        <Card decoration="top" decorationColor="red">
          <Text>Open anomalies (Critical / High)</Text>
          <Metric>
            {d.crit} / {d.high}
          </Metric>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>Est. revenue at risk (₹ Cr / yr)</Text>
          <Metric>{(d.rev / 1e7).toFixed(2)}</Metric>
        </Card>
      </div>
      <Card>
        <Title>Network supplied vs billed (30 days)</Title>
        <AreaChart
          className="mt-4 h-72"
          data={d.suppliedVsBilled}
          index="day"
          categories={["Supplied", "Billed"]}
          colors={["amber", "yellow"]}
        />
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Title>Substation map</Title>
          <Text className="mb-2">Click markers to open substation detail (Leaflet + OSM).</Text>
          <SubstationMapDynamic items={d.mapItems} />
        </Card>
        <Card>
          <Title>Open anomalies by type</Title>
          <DonutChart
            className="mt-4 h-56"
            data={d.typeDonut.length ? d.typeDonut : [{ name: "None", value: 1 }]}
            category="value"
            index="name"
            colors={["amber", "yellow", "orange", "red", "stone"]}
          />
        </Card>
      </div>
      <Card>
        <Title>Recent critical / high anomalies</Title>
        <ul className="mt-2 divide-y divide-amber-100">
          {d.recent.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between py-2 text-sm">
              <span className="font-medium text-amber-900">{a.type.replace(/_/g, " ")}</span>
              <span className="text-stone-600">{a.feeder?.code ?? "—"}</span>
              <Link href={`/anomalies/${a.id}`} className="text-amber-800 underline">
                View
              </Link>
            </li>
          ))}
        </ul>
        {d.recent.length === 0 ? <p className="text-stone-500">No open critical/high items.</p> : null}
      </Card>
    </div>
  );
}
