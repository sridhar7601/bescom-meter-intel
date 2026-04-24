import type { Prisma, PrismaClient } from "@prisma/client";
import { AnomalySeverity, AnomalyType } from "@/lib/enums";

const BYPASS_LOSS_PCT = 25;
const BYPASS_CONSUMER_ACTIVE_RATIO = 0.5;

export type ReconciliationContext = {
  windowStart: Date;
  windowEnd: Date;
  lossPct: number;
  kwhSupplied: number;
  sumConsumerKwh: number;
  activeConsumerRatio: number;
};

export async function evaluateBypassForFeeder(
  db: PrismaClient | Prisma.TransactionClient,
  feederId: string,
  windowStart: Date,
  windowEnd: Date
): Promise<ReconciliationContext & { isBypass: boolean }> {
  const agg = await db.feederReading.aggregate({
    where: { feederId, timestamp: { gte: windowStart, lte: windowEnd } },
    _sum: { kwhSupplied: true, kwhBilled: true, lossKwh: true },
  });
  const kwhSupplied = agg._sum.kwhSupplied ?? 0;
  const sumConsumerBilled = agg._sum.kwhBilled ?? 0;
  const sumConsumerKwh = sumConsumerBilled;
  const lossKwh = Math.max(0, kwhSupplied - sumConsumerKwh);
  const lossPct = kwhSupplied > 0 ? (lossKwh / kwhSupplied) * 100 : 0;

  const consumerIds = (await db.consumer.findMany({ where: { feederId }, select: { id: true } })).map((c) => c.id);
  const total = consumerIds.length;
  let active = 0;
  if (total > 0) {
    const rows = await db.consumerReading.groupBy({
      by: ["consumerId"],
      where: { consumerId: { in: consumerIds }, timestamp: { gte: windowStart, lte: windowEnd } },
      _sum: { kwh: true },
    });
    const withEnergy = new Set(
      rows.filter((r) => (r._sum.kwh ?? 0) > 3).map((r) => r.consumerId)
    );
    active = withEnergy.size;
  }
  const activeConsumerRatio = total > 0 ? active / total : 0;
  const isBypass =
    lossPct > BYPASS_LOSS_PCT && activeConsumerRatio < BYPASS_CONSUMER_ACTIVE_RATIO;

  return {
    windowStart,
    windowEnd,
    lossPct,
    kwhSupplied,
    sumConsumerKwh,
    activeConsumerRatio,
    isBypass,
  };
}

export function bypassSeverity(lossPct: number): AnomalySeverity {
  if (lossPct >= 35) return AnomalySeverity.CRITICAL;
  if (lossPct >= 30) return AnomalySeverity.HIGH;
  return AnomalySeverity.MEDIUM;
}

export function defaultBypassEvidence(ctx: ReconciliationContext) {
  return {
    kwhSupplied: Math.round(ctx.kwhSupplied * 10) / 10,
    kwhBilled: Math.round(ctx.sumConsumerKwh * 10) / 10,
    lossKwh: Math.round((ctx.kwhSupplied - ctx.sumConsumerKwh) * 10) / 10,
    lossPct: Math.round(ctx.lossPct * 100) / 100,
    activeConsumerRatio: Math.round(ctx.activeConsumerRatio * 100) / 100,
    windowDays: Math.ceil(
      (ctx.windowEnd.getTime() - ctx.windowStart.getTime()) / (24 * 3600 * 1000)
    ),
  };
}

export const FeederReconciliation = {
  type: AnomalyType.BYPASS_SUSPECTED,
};
