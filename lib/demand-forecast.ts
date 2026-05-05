// Localized demand forecasting (Part A of Theme 8 brief).
// Hourly day-ahead forecast per feeder using a seasonal-naive base + recent trend correction.
// Deterministic, explainable, and runs in <50 ms over 30 days of hourly data.
//
// Production note: This is a calibratable heuristic. The same forecast() interface accepts
// a swap to ARIMA/Prophet/N-BEATS without changing the dashboard, scheduler, or risk logic.

export interface FeederHourlyReading {
  timestamp: Date;
  kwhSupplied: number;
  kwhBilled: number;
}

export interface ForecastPoint {
  timestamp: Date;
  forecastKwh: number;
  lowerBoundKwh: number;
  upperBoundKwh: number;
  basis: "seasonal_naive_trend";
}

export type RiskLevel = "HIGH" | "MEDIUM" | "NORMAL";

export interface FeederForecast {
  feederId: string;
  forecast: ForecastPoint[];           // next 24 hours
  meanKwh: number;                     // historical 30-d mean (per hour)
  peakKwh: number;                     // forecast peak (kWh/h)
  peakHour: number;                    // hour of day for forecast peak (0-23)
  riskLevel: RiskLevel;
  riskReason: string;
  confidenceMape: number;              // back-test MAPE % on last 24h hold-out
}

/** seasonal-naive: forecast for hour h = mean of last 4 weeks at the same dayOfWeek+hour */
function seasonalNaiveSamples(history: FeederHourlyReading[], target: Date, lookbackWeeks = 4): number[] {
  const targetDow = target.getDay();
  const targetHour = target.getHours();
  const samples: number[] = [];
  for (let w = 1; w <= lookbackWeeks; w++) {
    const ts = new Date(target.getTime() - w * 7 * 24 * 3600 * 1000);
    const match = history.find(
      (h) => h.timestamp.getDay() === targetDow && h.timestamp.getHours() === targetHour && Math.abs(h.timestamp.getTime() - ts.getTime()) < 90 * 60 * 1000,
    );
    if (match) samples.push(match.kwhSupplied);
  }
  return samples;
}

/** trend factor: ratio of last 7-day mean to all-history mean. Captures recent shift. */
function trendFactor(history: FeederHourlyReading[]): number {
  if (history.length < 24 * 14) return 1;
  const sortedAsc = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const last7 = sortedAsc.slice(-24 * 7);
  const all = sortedAsc;
  const m = (arr: FeederHourlyReading[]) => arr.reduce((s, r) => s + r.kwhSupplied, 0) / arr.length;
  const recentMean = m(last7);
  const allMean = m(all);
  if (allMean === 0) return 1;
  const f = recentMean / allMean;
  // Clamp to reasonable range to avoid runaway from outliers
  return Math.max(0.6, Math.min(1.6, f));
}

function stdev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Day-ahead 24h forecast for a single feeder.
 * Uses seasonal-naive (4-week lookback at same dayOfWeek+hour) × trend factor.
 * Confidence band: ±1.96σ from the seasonal-naive samples.
 */
export function forecastFeeder(
  feederId: string,
  history: FeederHourlyReading[],
  capacityKW: number,
  startTime: Date = new Date(),
): FeederForecast {
  const startUtc = new Date(startTime);
  startUtc.setMinutes(0, 0, 0);
  startUtc.setHours(startUtc.getHours() + 1);

  const trend = trendFactor(history);
  const allMean = history.length > 0 ? history.reduce((s, r) => s + r.kwhSupplied, 0) / history.length : 0;

  const forecast: ForecastPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const target = new Date(startUtc.getTime() + h * 3600 * 1000);
    const samples = seasonalNaiveSamples(history, target);
    const baseline = samples.length > 0 ? samples.reduce((s, v) => s + v, 0) / samples.length : allMean;
    const forecastKwh = Number((baseline * trend).toFixed(3));
    const sd = stdev(samples);
    const margin = Number((1.96 * sd * trend).toFixed(3));
    forecast.push({
      timestamp: target,
      forecastKwh,
      lowerBoundKwh: Number(Math.max(0, forecastKwh - margin).toFixed(3)),
      upperBoundKwh: Number((forecastKwh + margin).toFixed(3)),
      basis: "seasonal_naive_trend",
    });
  }

  const peak = forecast.reduce((max, p) => (p.forecastKwh > max.forecastKwh ? p : max), forecast[0]);
  const peakKwh = peak?.forecastKwh ?? 0;
  const peakHour = peak ? peak.timestamp.getHours() : 0;

  // Risk classification: forecast peak vs historical mean ratio
  let riskLevel: RiskLevel = "NORMAL";
  let riskReason = "";
  const ratio = allMean > 0 ? peakKwh / allMean : 1;
  if (ratio >= 1.3 || trend >= 1.25) {
    riskLevel = "HIGH";
    riskReason = `Forecast peak ${peakKwh.toFixed(1)} kWh is ${(ratio * 100).toFixed(0)}% of 30-day mean${trend >= 1.25 ? `; recent 7-day load ${(trend * 100).toFixed(0)}% of baseline` : ""}.`;
  } else if (ratio >= 1.1 || trend >= 1.1) {
    riskLevel = "MEDIUM";
    riskReason = `Forecast peak ${peakKwh.toFixed(1)} kWh elevated vs mean (${(ratio * 100).toFixed(0)}%).`;
  } else {
    riskReason = `Forecast peak within ${(ratio * 100).toFixed(0)}% of historical mean; no stress signal.`;
  }

  // Back-test MAPE: forecast yesterday's last 24h using same model on data prior to that
  const sortedAsc = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const cutoff = sortedAsc.length - 24;
  let mape = 0;
  let mapeN = 0;
  if (cutoff > 24 * 28) {
    const trainHistory = sortedAsc.slice(0, cutoff);
    const heldOut = sortedAsc.slice(cutoff);
    for (const actual of heldOut) {
      const samples = seasonalNaiveSamples(trainHistory, actual.timestamp);
      if (samples.length === 0) continue;
      const baseline = samples.reduce((s, v) => s + v, 0) / samples.length;
      const predicted = baseline * trendFactor(trainHistory);
      if (actual.kwhSupplied > 0) {
        mape += Math.abs(actual.kwhSupplied - predicted) / actual.kwhSupplied;
        mapeN += 1;
      }
    }
  }
  const confidenceMape = mapeN > 0 ? Number(((mape / mapeN) * 100).toFixed(1)) : 0;

  return {
    feederId,
    forecast,
    meanKwh: Number(allMean.toFixed(3)),
    peakKwh: Number(peakKwh.toFixed(3)),
    peakHour,
    riskLevel,
    riskReason,
    confidenceMape,
  };
}

/** Aggregate per-feeder forecasts into a fleet-level 24h curve (sum). */
export function aggregateFleet(forecasts: FeederForecast[]): ForecastPoint[] {
  if (forecasts.length === 0) return [];
  const out: ForecastPoint[] = [];
  for (let h = 0; h < 24; h++) {
    let f = 0, l = 0, u = 0;
    let ts: Date | null = null;
    for (const ff of forecasts) {
      const p = ff.forecast[h];
      if (!p) continue;
      ts = p.timestamp;
      f += p.forecastKwh;
      l += p.lowerBoundKwh;
      u += p.upperBoundKwh;
    }
    if (ts) {
      out.push({
        timestamp: ts,
        forecastKwh: Number(f.toFixed(3)),
        lowerBoundKwh: Number(l.toFixed(3)),
        upperBoundKwh: Number(u.toFixed(3)),
        basis: "seasonal_naive_trend",
      });
    }
  }
  return out;
}
