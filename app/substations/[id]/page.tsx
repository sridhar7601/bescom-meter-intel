import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { RunDetectButton } from "@/components/run-detect-button";

type Params = { params: Promise<{ id: string }> };

export default async function SubstationPage({ params }: Params) {
  const { id } = await params;
  const s = await db.substation.findUnique({
    where: { id },
    include: {
      feeders: {
        orderBy: { code: "asc" },
        include: { _count: { select: { anomalies: true } } },
      },
    },
  });
  if (!s) notFound();
  const enriched = await Promise.all(
    s.feeders.map(async (f) => {
      const last = await db.feederReading.findFirst({
        where: { feederId: f.id },
        orderBy: { timestamp: "desc" },
      });
      return { f, last };
    })
  );
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500">{s.code}</p>
        <h1 className="text-3xl font-bold text-amber-900">{s.name}</h1>
        <p className="text-stone-600">
          {s.division} · {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
        </p>
      </div>
      <RunDetectButton />
      <div className="overflow-x-auto rounded-lg border border-amber-100 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-amber-50 text-amber-900">
            <tr>
              <th className="px-4 py-2">Feeder</th>
              <th className="px-4 py-2">Loss % (latest)</th>
              <th className="px-4 py-2">Anomalies</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(({ f, last }) => (
              <tr key={f.id} className="border-t border-amber-100">
                <td className="px-4 py-2">
                  <Link className="font-medium text-amber-800 underline" href={`/feeders/${f.id}`}>
                    {f.code}
                  </Link>
                  <div className="text-stone-500">{f.name}</div>
                </td>
                <td className="px-4 py-2">{(last?.lossPct ?? 0).toFixed(1)}%</td>
                <td className="px-4 py-2">{f._count.anomalies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
