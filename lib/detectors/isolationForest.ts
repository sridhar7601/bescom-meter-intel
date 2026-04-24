import { IsolationForest } from "isolation-forest";
import { AnomalySeverity, AnomalyType } from "@/lib/enums";
import type { ConsumerReading } from "@prisma/client";

const FEATURE_KEYS = ["f0", "f1", "f2", "f3", "f4", "f5"] as const;

function mean(a: number[]): number {
  if (a.length === 0) return 0;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

function stddev(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

function toDataObject(f: number[]): Record<string, number> {
  const o: Record<string, number> = {};
  f.forEach((v, i) => {
    o[FEATURE_KEYS[i] ?? `f${i}`] = v;
  });
  return o;
}

function zscoreOutlier(featMatrix: number[][]): number[] {
  const dim = featMatrix[0]?.length ?? 0;
  const scores = featMatrix.map(() => 0);
  for (let d = 0; d < dim; d++) {
    const col = featMatrix.map((row) => row[d]!);
    const m = mean(col);
    const s = stddev(col) || 1e-6;
    for (let i = 0; i < col.length; i++) {
      scores[i]! += Math.abs((col[i]! - m) / s);
    }
  }
  return scores;
}

export type IsolationResult = {
  consumerKey: string;
  score: number;
  featureVector: number[];
  severity: AnomalySeverity;
};

export function buildConsumerFeatureVector(
  readings: Pick<
    ConsumerReading,
    "kwh" | "voltage" | "powerFactor" | "reverseFlow" | "commStatus" | "timestamp"
  >[]
): { key: string; features: number[]; windowStart: Date; windowEnd: Date } {
  if (readings.length === 0) {
    return {
      key: "",
      features: [0, 0, 1, 0, 0, 0.9],
      windowStart: new Date(),
      windowEnd: new Date(),
    };
  }
  const sorted = [...readings].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
  const windowStart = sorted[0]!.timestamp;
  const windowEnd = sorted[sorted.length - 1]!.timestamp;
  const kwhs = sorted.map((r) => r.kwh);
  const meanK = mean(kwhs);
  const stdK = stddev(kwhs);
  const dayBorders = new Set<string>();
  sorted.forEach((r) => {
    dayBorders.add(r.timestamp.toISOString().slice(0, 10));
  });
  let zeroDayCount = 0;
  for (const day of dayBorders) {
    const dayKwh = sorted
      .filter((r) => r.timestamp.toISOString().slice(0, 10) === day)
      .reduce((s, r) => s + r.kwh, 0);
    if (dayKwh < 0.1) zeroDayCount += 1;
  }
  const zeroDaysRatio = dayBorders.size > 0 ? zeroDayCount / dayBorders.size : 0;
  const voltageDropouts = sorted.filter(
    (r) => r.voltage != null && r.voltage < 160
  ).length;
  const reverseFlowCount = sorted.filter((r) => r.reverseFlow).length;
  const pfs = sorted
    .map((r) => r.powerFactor)
    .filter((x): x is number => x != null);
  const pfMean = pfs.length ? mean(pfs) : 0.9;
  const features = [
    meanK,
    stdK,
    zeroDaysRatio,
    voltageDropouts,
    reverseFlowCount,
    pfMean,
  ];
  return { key: "", features, windowStart, windowEnd };
}

export function runIsolationForestOnConsumers(
  entries: { consumerId: string; features: number[] }[]
): IsolationResult[] {
  if (entries.length < 2) return [];
  const X = entries.map((e) => toDataObject(e.features));
  let scores: number[];
  try {
    const forest = new IsolationForest(64, Math.min(256, entries.length));
    forest.fit(X);
    scores = forest.predict(X);
  } catch {
    const matrix = entries.map((e) => e.features);
    const zz = zscoreOutlier(matrix);
    const zmax = Math.max(...zz, 1e-6);
    scores = zz.map((z) => Math.min(0.99, z / (zmax * 1.2)));
  }

  const results: IsolationResult[] = entries.map((e, i) => {
    const s = scores[i] ?? 0;
    let severity: AnomalySeverity = AnomalySeverity.LOW;
    if (s >= 0.65) severity = AnomalySeverity.CRITICAL;
    else if (s >= 0.55) severity = AnomalySeverity.HIGH;
    else if (s >= 0.45) severity = AnomalySeverity.MEDIUM;
    return { consumerKey: e.consumerId, score: s, featureVector: e.features, severity };
  });
  const threshold = 0.42;
  return results.filter((r) => r.score >= threshold);
}

export const IsolationLabels = {
  type: AnomalyType.TAMPER_SUSPECTED,
};

export function zscoreAnomalyFromFeatures(
  entries: { consumerId: string; features: number[] }[]
): IsolationResult[] {
  if (entries.length < 3) return [];
  const matrix = entries.map((e) => e.features);
  const zz = zscoreOutlier(matrix);
  const m = mean(zz);
  const s = stddev(zz) || 1e-6;
  return entries
    .map((e, i) => {
      const z = (zz[i]! - m) / s;
      const score = Math.min(0.99, 0.5 + Math.max(0, z) * 0.15);
      let severity: AnomalySeverity = AnomalySeverity.LOW;
      if (z > 2) severity = AnomalySeverity.CRITICAL;
      else if (z > 1.2) severity = AnomalySeverity.HIGH;
      else if (z > 0.8) severity = AnomalySeverity.MEDIUM;
      return { consumerKey: e.consumerId, score, featureVector: e.features, severity };
    })
    .filter((_, i) => (zz[i]! - m) / s > 1.0);
}
