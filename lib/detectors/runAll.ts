import "dotenv/config";
import type { Prisma } from "@prisma/client";
import { AnomalyStatus } from "@/lib/enums";
import { db } from "@/lib/db";
import { explainAnomaly } from "@/lib/ai";
import { buildConsumerFeatureVector, runIsolationForestOnConsumers } from "@/lib/detectors/isolationForest";
import { defaultBypassEvidence, evaluateBypassForFeeder, bypassSeverity } from "@/lib/detectors/feederReconciliation";
import { lookback30d, runRuleDetectors } from "@/lib/detectors/rules";

type RunStats = { newAnomalies: number; byType: Record<string, number>; bySeverity: Record<string, number> };

function emptyStats(): RunStats {
  return { newAnomalies: 0, byType: {}, bySeverity: {} };
}

function bump(m: Record<string, number>, k: string) {
  m[k] = (m[k] ?? 0) + 1;
}

function rowKey(r: Prisma.AnomalyCreateManyInput) {
  return `${r.type}|${r.consumerId ?? "none"}|${r.feederId ?? "none"}`;
}

function dedupe(rows: Prisma.AnomalyCreateManyInput[]) {
  const m = new Map<string, Prisma.AnomalyCreateManyInput>();
  for (const r of rows) {
    const k = rowKey(r);
    const prev = m.get(k);
    if (!prev || (r.score ?? 0) > (prev.score ?? 0)) m.set(k, r);
  }
  return [...m.values()];
}

function buildStats(rows: Prisma.AnomalyCreateManyInput[]): RunStats {
  const s = emptyStats();
  s.newAnomalies = rows.length;
  for (const r of rows) {
    if (r.type) bump(s.byType, r.type);
    if (r.severity) bump(s.bySeverity, r.severity);
  }
  return s;
}

export async function runAnomalyPipeline(now = new Date()): Promise<RunStats> {
  const { from, to } = lookback30d(now);
  await db.anomaly.deleteMany({});

  const consumers = await db.consumer.findMany({
    include: { readings: { where: { timestamp: { gte: from, lte: to } } } },
  });

  const byFeeder = new Map<string, typeof consumers>();
  for (const c of consumers) {
    const list = byFeeder.get(c.feederId) ?? [];
    list.push(c);
    byFeeder.set(c.feederId, list);
  }

  const rowsToCreate: Prisma.AnomalyCreateManyInput[] = [];

  for (const [feederId, list] of byFeeder) {
    const featureEntries = list.map((c) => {
      const fv = buildConsumerFeatureVector(c.readings);
      return { consumerId: c.id, features: fv.features, window: fv };
    });
    if (featureEntries.length < 2) continue;
    const ifInput = featureEntries.map((e) => ({
      consumerId: e.consumerId,
      features: e.features,
    }));
    const ifRes = runIsolationForestOnConsumers(ifInput);
    for (const r of ifRes) {
      const c = list.find((x) => x.id === r.consumerKey)!;
      const w = featureEntries.find((e) => e.consumerId === c.id)!.window;
      const ev = {
        model: "isolation-forest",
        featureVector: r.featureVector,
        meanK: r.featureVector[0],
        stdK: r.featureVector[1],
        reason: "multivariate outlier vs feeder cohort",
      };
      const reasoning = await explainAnomaly("TAMPER_SUSPECTED", JSON.stringify(ev));
      rowsToCreate.push({
        consumerId: c.id,
        feederId,
        type: "TAMPER_SUSPECTED",
        severity: r.severity,
        status: AnomalyStatus.OPEN,
        detectedAt: now,
        windowStart: w.windowStart,
        windowEnd: w.windowEnd,
        score: r.score,
        evidence: JSON.stringify(ev),
        reasoning,
        estimatedLossKwh: (r.featureVector[0] ?? 0) * 2,
        estimatedRevenueLossInr: ((r.featureVector[0] ?? 0) * 2 * 6) as number,
      });
    }
  }

  for (const c of consumers) {
    const hits = runRuleDetectors(c, c.readings);
    for (const h of hits) {
      const evJson = { ...h.evidence, type: h.type, consumerRr: c.rrNumber };
      const reasoning = await explainAnomaly(h.type, JSON.stringify(evJson));
      rowsToCreate.push({
        consumerId: c.id,
        feederId: c.feederId,
        type: h.type,
        severity: h.severity,
        status: AnomalyStatus.OPEN,
        detectedAt: now,
        windowStart: h.windowStart,
        windowEnd: h.windowEnd,
        score: h.score,
        evidence: JSON.stringify(evJson),
        reasoning,
        estimatedLossKwh: 40,
        estimatedRevenueLossInr: 240,
      });
    }
  }

  const feeders = await db.feeder.findMany();
  for (const f of feeders) {
    const ctx = await evaluateBypassForFeeder(db, f.id, from, to);
    if (ctx.isBypass) {
      const ev = defaultBypassEvidence(ctx);
      const reasoning = await explainAnomaly("BYPASS_SUSPECTED", JSON.stringify(ev));
      rowsToCreate.push({
        consumerId: null,
        feederId: f.id,
        type: "BYPASS_SUSPECTED",
        severity: bypassSeverity(ctx.lossPct),
        status: AnomalyStatus.OPEN,
        detectedAt: now,
        windowStart: from,
        windowEnd: to,
        score: Math.min(0.99, ctx.lossPct / 100),
        evidence: JSON.stringify(ev),
        reasoning,
        estimatedLossKwh: ev.lossKwh as number,
        estimatedRevenueLossInr: (ev.lossKwh as number) * 6,
      });
    }
  }

  const finalRows = dedupe(rowsToCreate);
  for (let i = 0; i < finalRows.length; i += 200) {
    await db.anomaly.createMany({ data: finalRows.slice(i, i + 200) });
  }
  return buildStats(finalRows);
}
