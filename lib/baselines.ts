// Forecast baselines — required by Theme 8 brief:
// "Outputs should be comparable against simple baselines such as historical averages."
//
// Two reference baselines:
// 1. Historical 30-day average (per hour-of-day)
// 2. Persistence — last week same hour
// Both compared against our seasonal-naive + trend forecast on a hold-out window.

import type { FeederHourlyReading } from "./demand-forecast";

export interface BaselineResult {
  modelMape: number;          // our forecast back-test MAPE %
  histAvgMape: number;        // hour-of-day mean baseline MAPE
  persistenceMape: number;    // last-week-same-hour baseline MAPE
  improvementVsHistAvgPct: number;
  improvementVsPersistencePct: number;
  sampleSize: number;
}

function mape(actual: number[], predicted: number[]): { value: number; n: number } {
  let sum = 0, n = 0;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] > 0) {
      sum += Math.abs(actual[i] - predicted[i]) / actual[i];
      n += 1;
    }
  }
  return { value: n > 0 ? (sum / n) * 100 : 0, n };
}

function historicalAverage(history: FeederHourlyReading[], target: Date): number {
  const hour = target.getHours();
  const matches = history.filter((h) => h.timestamp.getHours() === hour);
  if (matches.length === 0) return 0;
  return matches.reduce((s, r) => s + r.kwhSupplied, 0) / matches.length;
}

function persistence(history: FeederHourlyReading[], target: Date): number {
  const weekAgo = new Date(target.getTime() - 7 * 24 * 3600 * 1000);
  const match = history.find((h) => Math.abs(h.timestamp.getTime() - weekAgo.getTime()) < 90 * 60 * 1000);
  return match ? match.kwhSupplied : 0;
}

import { forecastFeeder } from "./demand-forecast";

/**
 * Back-test our forecast vs the two simple baselines on the most recent 24h hold-out.
 * Returns MAPE for each + improvement % over baselines.
 */
export function compareBaselines(
  feederId: string,
  history: FeederHourlyReading[],
  capacityKW: number,
): BaselineResult {
  const sortedAsc = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  if (sortedAsc.length < 24 * 28) {
    return {
      modelMape: 0, histAvgMape: 0, persistenceMape: 0,
      improvementVsHistAvgPct: 0, improvementVsPersistencePct: 0, sampleSize: 0,
    };
  }
  const cutoff = sortedAsc.length - 24;
  const trainHistory = sortedAsc.slice(0, cutoff);
  const heldOut = sortedAsc.slice(cutoff);

  const actual = heldOut.map((r) => r.kwhSupplied);

  // Our model
  const modelForecast = forecastFeeder(feederId, trainHistory, capacityKW, heldOut[0].timestamp);
  const modelPred = modelForecast.forecast.map((p) => p.forecastKwh);

  // Hist avg baseline
  const histAvgPred = heldOut.map((r) => historicalAverage(trainHistory, r.timestamp));

  // Persistence baseline
  const persistPred = heldOut.map((r) => persistence(trainHistory, r.timestamp));

  const m1 = mape(actual, modelPred);
  const m2 = mape(actual, histAvgPred);
  const m3 = mape(actual, persistPred);

  const improvementVsHistAvg = m2.value > 0 ? ((m2.value - m1.value) / m2.value) * 100 : 0;
  const improvementVsPersistence = m3.value > 0 ? ((m3.value - m1.value) / m3.value) * 100 : 0;

  return {
    modelMape: Number(m1.value.toFixed(2)),
    histAvgMape: Number(m2.value.toFixed(2)),
    persistenceMape: Number(m3.value.toFixed(2)),
    improvementVsHistAvgPct: Number(improvementVsHistAvg.toFixed(1)),
    improvementVsPersistencePct: Number(improvementVsPersistence.toFixed(1)),
    sampleSize: m1.n,
  };
}
