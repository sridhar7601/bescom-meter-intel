import { AnomalySeverity, AnomalyType } from "@/lib/enums";
import type { Consumer, ConsumerReading } from "@prisma/client";

const MS_DAY = 24 * 60 * 60 * 1000;

function sortedByTime<T extends { timestamp: Date }>(r: T[]) {
  return [...r].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function consecutiveZeroDaysKwh(
  r: Array<Pick<ConsumerReading, "kwh" | "timestamp" | "voltage">>
): { met: boolean; start: Date; end: Date } {
  const rows = sortedByTime(r);
  if (rows.length < 2) return { met: false, start: new Date(), end: new Date() };
  const byDay = new Map<string, { kwh: number; maxV: number }>();
  for (const row of rows) {
    const d = row.timestamp.toISOString().slice(0, 10);
    const b = byDay.get(d) ?? { kwh: 0, maxV: 0 };
    b.kwh += row.kwh;
    b.maxV = Math.max(b.maxV, row.voltage ?? 0);
    byDay.set(d, b);
  }
  const days = [...byDay.keys()].sort();
  let run = 0;
  let runStart = days[0] ?? "";
  for (const d of days) {
    const v = byDay.get(d)!;
    if (v.kwh < 0.05 && v.maxV > 5) {
      if (run === 0) runStart = d;
      run += 1;
    } else {
      run = 0;
    }
    if (run >= 7) {
      return {
        met: true,
        start: new Date(runStart + "T00:00:00.000Z"),
        end: new Date(d + "T23:59:59.000Z"),
      };
    }
  }
  return { met: false, start: new Date(), end: new Date() };
}

export type RuleHit = {
  type: AnomalyType;
  severity: AnomalySeverity;
  windowStart: Date;
  windowEnd: Date;
  score: number;
  evidence: Record<string, string | number | boolean | null | undefined>;
};

function reverseFlowHits(
  consumer: Consumer,
  readings: ConsumerReading[]
): RuleHit | null {
  const bad = readings.filter((x) => x.reverseFlow);
  if (bad.length === 0) return null;
  return {
    type: AnomalyType.REVERSE_FLOW,
    severity: AnomalySeverity.HIGH,
    windowStart: bad[0]!.timestamp,
    windowEnd: bad[bad.length - 1]!.timestamp,
    score: 0.9,
    evidence: {
      intervals: bad.length,
      lastTs: bad[0]!.timestamp.toISOString(),
      consumerId: consumer.id,
    },
  };
}

function powerFactorDrop(
  consumer: Consumer,
  readings: ConsumerReading[]
): RuleHit | null {
  const low = sortedByTime(readings).filter(
    (r) => r.powerFactor != null && r.powerFactor < 0.6
  );
  if (low.length < 2) return null;
  return {
    type: AnomalyType.POWER_FACTOR_DROP,
    severity: AnomalySeverity.MEDIUM,
    windowStart: low[0]!.timestamp,
    windowEnd: low[low.length - 1]!.timestamp,
    score: 0.78,
    evidence: { samples: low.length, minPf: Math.min(...low.map((r) => r.powerFactor!)) },
  };
}

function voltageSag(consumer: Consumer, readings: ConsumerReading[]): RuleHit | null {
  const rows = sortedByTime(readings);
  const sags = rows.filter(
    (r) => r.voltage != null && r.voltage < 180 && r.voltage > 1
  );
  if (sags.length < 2) return null;
  const t0 = sags[0]!.timestamp.getTime();
  const t1 = sags[sags.length - 1]!.timestamp.getTime();
  if (t1 - t0 < 2 * 60 * 60 * 1000) return null;
  return {
    type: AnomalyType.VOLTAGE_SAG,
    severity: AnomalySeverity.MEDIUM,
    windowStart: sags[0]!.timestamp,
    windowEnd: sags[sags.length - 1]!.timestamp,
    score: 0.7,
    evidence: { minV: Math.min(...sags.map((r) => r.voltage!)) },
  };
}

function commLoss(consumer: Consumer, readings: ConsumerReading[]): RuleHit | null {
  const rows = sortedByTime(readings);
  const miss = rows.filter((r) => r.commStatus === "missing");
  if (miss.length < 2) return null;
  const tSpan =
    (miss[miss.length - 1]!.timestamp.getTime() - miss[0]!.timestamp.getTime()) / (60 * 60 * 1000);
  if (tSpan < 12) return null;
  return {
    type: AnomalyType.METER_COMM_LOSS,
    severity: AnomalySeverity.HIGH,
    windowStart: miss[0]!.timestamp,
    windowEnd: miss[miss.length - 1]!.timestamp,
    score: 0.8,
    evidence: { missingIntervals: miss.length, spanHrs: Math.round(tSpan) },
  };
}

function zeroConsumptionLive(consumer: Consumer, readings: ConsumerReading[]): RuleHit | null {
  const z = consecutiveZeroDaysKwh(readings);
  if (!z.met) return null;
  return {
    type: AnomalyType.ZERO_CONSUMPTION_LIVE,
    severity: AnomalySeverity.CRITICAL,
    windowStart: z.start,
    windowEnd: z.end,
    score: 0.95,
    evidence: { daysWithVoltageNoEnergy: 7 },
  };
}

function tamperSuspectRule(consumer: Consumer, readings: ConsumerReading[]): RuleHit | null {
  const rows = sortedByTime(readings);
  const tamp = rows.filter(
    (r) => r.commStatus === "tamper_flag" && (r.voltage ?? 0) > 1 && (r.kwh ?? 0) < 0.1
  );
  if (tamp.length < 2) return null;
  return {
    type: AnomalyType.TAMPER_SUSPECTED,
    severity: AnomalySeverity.HIGH,
    windowStart: tamp[0]!.timestamp,
    windowEnd: tamp[tamp.length - 1]!.timestamp,
    score: 0.72,
    evidence: { tamperFlagCount: tamp.length, consumerId: consumer.id },
  };
}

export function runRuleDetectors(
  consumer: Consumer,
  readings: ConsumerReading[]
): RuleHit[] {
  const out: RuleHit[] = [];
  if (readings.length === 0) return out;
  const z = zeroConsumptionLive(consumer, readings);
  if (z) out.push(z);
  const r = reverseFlowHits(consumer, readings);
  if (r) out.push(r);
  const pf = powerFactorDrop(consumer, readings);
  if (pf) out.push(pf);
  const v = voltageSag(consumer, readings);
  if (v) out.push(v);
  const c = commLoss(consumer, readings);
  if (c) out.push(c);
  const t = tamperSuspectRule(consumer, readings);
  if (t) out.push(t);
  return out;
}

export function lookback30d(now: Date) {
  return { from: new Date(now.getTime() - 30 * MS_DAY), to: now };
}
