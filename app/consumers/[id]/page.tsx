import Link from "next/link";
import { notFound } from "next/navigation";
import { LineChart, Card, Title, Text } from "@tremor/react";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export default async function ConsumerPage({ params }: Params) {
  const { id } = await params;
  const c = await db.consumer.findUnique({
    where: { id },
    include: { feeder: { include: { substation: true } } },
  });
  if (!c) notFound();
  const history = await db.consumerReading.findMany({
    where: { consumerId: id },
    orderBy: { timestamp: "asc" },
  });
  const anomalies = await db.anomaly.findMany({ where: { consumerId: id } });
  const chart = history.map((r) => ({
    t: r.timestamp.toISOString().slice(5, 16),
    kWh: r.kwh,
    "Voltage (V)": r.voltage ?? 0,
  }));
  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-500">
        <Link className="text-amber-800 underline" href={`/feeders/${c.feederId}`}>
          {c.feeder.code}
        </Link>{" "}
        · {c.feeder.substation.name}
      </p>
      <h1 className="text-3xl font-bold text-amber-900">{c.name}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <Text>RR / Type</Text>
          <p className="text-lg font-semibold">{c.rrNumber}</p>
          <p className="text-stone-600">{c.type}</p>
        </Card>
        <Card>
          <Text>Sanctioned load</Text>
          <p className="text-2xl font-semibold">{c.sanctionedLoad.toFixed(1)} kW</p>
        </Card>
        <Card>
          <Text>Pincode</Text>
          <p className="text-2xl font-semibold">{c.pincode}</p>
        </Card>
      </div>
      <Card>
        <Title>kWh & voltage (6h intervals)</Title>
        <LineChart
          className="mt-4 h-80"
          data={chart}
          index="t"
          categories={["kWh", "Voltage (V)"]}
          colors={["amber", "stone"]}
        />
      </Card>
      <Card>
        <Title>Linked anomalies</Title>
        <ul className="mt-2 space-y-1 text-sm">
          {anomalies.length === 0 ? <li className="text-stone-500">None</li> : null}
          {anomalies.map((a) => (
            <li key={a.id}>
              <Link className="text-amber-800 underline" href={`/anomalies/${a.id}`}>
                {a.type} · {a.severity}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <div className="overflow-x-auto rounded-lg border border-amber-100">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-amber-50">
            <tr>
              <th className="px-2 py-1">Time</th>
              <th className="px-2 py-1">kWh</th>
              <th className="px-2 py-1">V</th>
              <th className="px-2 py-1">PF</th>
              <th className="px-2 py-1">Rev</th>
            </tr>
          </thead>
          <tbody>
            {history.slice(-40).map((r) => (
              <tr key={r.id} className="border-t border-amber-50">
                <td className="px-2 py-1 font-mono text-xs">{r.timestamp.toISOString()}</td>
                <td className="px-2 py-1">{r.kwh.toFixed(2)}</td>
                <td className="px-2 py-1">{(r.voltage ?? 0).toFixed(0)}</td>
                <td className="px-2 py-1">{(r.powerFactor ?? 0).toFixed(2)}</td>
                <td className="px-2 py-1">{r.reverseFlow ? "Y" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
