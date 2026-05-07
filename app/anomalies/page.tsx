import { db } from "@/lib/db";
import { AnomalyTable } from "@/components/anomaly-table";

export default async function AnomaliesPage() {
  const list = await db.anomaly.findMany({
    orderBy: { detectedAt: "desc" },
    take: 200,
    include: { consumer: true, feeder: true },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">Anomaly ledger</h1>
        <p className="text-stone-600 text-sm mt-1">
          {list.length} detected anomalies · isolation-forest + rule-based detectors · click any row to inspect the evidence trail.
        </p>
      </div>
      <AnomalyTable
        initial={list.map((a) => ({
          id: a.id,
          type: a.type,
          severity: a.severity,
          status: a.status,
          detectedAt: a.detectedAt.toISOString(),
          evidence: a.evidence,
          reasoning: a.reasoning,
          feeder: a.feeder?.code,
          pincode: a.consumer?.pincode,
        }))}
      />
    </div>
  );
}
