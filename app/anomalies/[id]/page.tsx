import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { AnomalyActions } from "@/components/anomaly-actions";
import { explainAnomaly } from "@/lib/llm-narration";

type Params = { params: Promise<{ id: string }> };

export default async function AnomalyDetailPage({ params }: Params) {
  const { id } = await params;
  const a = await db.anomaly.findUnique({
    where: { id },
    include: { consumer: true, feeder: { include: { substation: true } } },
  });
  if (!a) notFound();
  let evidence: Record<string, unknown> = {};
  try { evidence = JSON.parse(a.evidence ?? "{}"); } catch { evidence = {}; }
  const aiAdvice = await explainAnomaly({
    anomalyId: a.id,
    type: a.type,
    severity: a.severity,
    consumerName: a.consumer?.name ?? null,
    feederName: a.feeder?.name ?? null,
    evidence,
    estimatedLossKwh: a.estimatedLossKwh ?? null,
    estimatedRevenueLossInr: a.estimatedRevenueLossInr ?? null,
  });
  let history: { at: string; from: string; to: string; actor: string }[] = [];
  try {
    history = JSON.parse(a.statusHistory ?? "[]");
  } catch {
    history = [];
  }
  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-stone-500">
        <Link className="text-amber-800 underline" href="/anomalies">
          All anomalies
        </Link>
      </p>
      <h1 className="text-3xl font-bold text-amber-900">{a.type.replace(/_/g, " ")}</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-900">{a.severity}</span>
        <span className="rounded bg-stone-100 px-2 py-0.5">{a.status}</span>
        {a.feeder ? (
          <Link className="text-amber-800 underline" href={`/feeders/${a.feederId}`}>
            {a.feeder.code}
          </Link>
        ) : null}
        {a.consumer ? (
          <Link className="text-amber-800 underline" href={`/consumers/${a.consumerId}`}>
            {a.consumer.rrNumber}
          </Link>
        ) : null}
      </div>
      <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4 text-sm">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-indigo-600" />
          <h2 className="font-semibold text-indigo-700">AI Inspector Recommendation</h2>
          <span className="text-[10px] uppercase tracking-wider rounded-full bg-indigo-600 text-white px-2 py-0.5 font-bold">Azure GPT-4.1</span>
        </div>
        <p className="text-stone-800">{aiAdvice}</p>
      </div>

      <div className="rounded-lg border border-amber-100 bg-white p-4 text-sm text-stone-800">
        <h2 className="font-semibold text-amber-900">Reasoning (rule output)</h2>
        <p className="mt-1">{a.reasoning}</p>
        <h2 className="mt-4 font-semibold text-amber-900">Evidence</h2>
        <pre className="mt-1 max-h-64 overflow-auto rounded bg-amber-50/50 p-2 text-xs">{a.evidence}</pre>
        <p className="mt-2 text-stone-600">
          Est. loss: {(a.estimatedLossKwh ?? 0).toFixed(0)} kWh · ₹
          {((a.estimatedRevenueLossInr ?? 0) / 1e5).toFixed(2)} L commercial gap (mock)
        </p>
      </div>
      <AnomalyActions id={a.id} status={a.status} />
      <div>
        <h2 className="text-lg font-semibold text-amber-900">Status history</h2>
        <ul className="mt-2 space-y-1 text-sm text-stone-600">
          {history.length === 0 ? <li>No events yet (OPEN).</li> : null}
          {history.map((h) => (
            <li key={h.at + h.to}>
              {h.at} · {h.from} → {h.to} · {h.actor}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
