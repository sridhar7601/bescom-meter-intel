// Azure OpenAI GPT-4.1 narration overlay for MeterSense AI.
// Grounded — LLM only describes pre-computed numbers (forecast MW, anomaly evidence, MAPE).
// No hallucinated values. Disk-cached. Brief non-negotiable: no hosted-LLM on real meter data
// → demo runs synthetic only; production swaps for on-prem Llama-3 / Mistral.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

function cacheDir(): string {
  return join(process.cwd(), "data", "llm-cache");
}

function readCache(key: string): string | null {
  const path = join(cacheDir(), `${key}.txt`);
  if (!existsSync(path)) return null;
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

function writeCache(key: string, text: string): void {
  mkdirSync(cacheDir(), { recursive: true });
  writeFileSync(join(cacheDir(), `${key}.txt`), text);
}

function hasLLM(): boolean {
  return !!(process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
}

async function rawLLM(systemPrompt: string, userContent: string, maxTokens = 200): Promise<string> {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (azureKey && azureEndpoint) {
    const res = await fetch(azureEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": azureKey },
      body: JSON.stringify({ messages, max_tokens: maxTokens, temperature: 0.2 }),
    });
    if (!res.ok) throw new Error(`Azure OpenAI HTTP ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No LLM API key configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: maxTokens, temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── 1. Dashboard daily briefing ──────────────────────────────────────────
export interface DashboardBriefingInput {
  totalSubstations: number;
  totalFeeders: number;
  totalConsumers: number;
  openAnomalies: number;
  criticalAnomalies: number;
  avgNetworkLossPct: number;
  estimatedRevenueLossInr: number;
  highRiskFeeders: number;
  fleetPeakKwh: number;
  fleetPeakHour: number;
  forecastModelMape: number;
}

export async function generateDashboardBriefing(input: DashboardBriefingInput): Promise<string> {
  const cacheKey = createHash("sha256")
    .update(JSON.stringify({ ...input, day: new Date().toISOString().slice(0, 10) }))
    .digest("hex").slice(0, 16);
  const cached = readCache(`briefing_${cacheKey}`);
  if (cached) return cached;

  if (!hasLLM()) {
    return `${input.totalFeeders} feeders, ${input.totalConsumers} consumers. ${input.openAnomalies} open anomalies (${input.criticalAnomalies} critical). Network avg loss ${input.avgNetworkLossPct.toFixed(1)}% — est. ₹${(input.estimatedRevenueLossInr/1e5).toFixed(1)}L/month leakage. ${input.highRiskFeeders} feeders flagged high-risk for tomorrow's peak.`;
  }

  const system =
    "You are the AI ops assistant for BESCOM (Bengaluru distribution utility) smart-meter intelligence. " +
    "Write a 3-sentence morning briefing for the network ops desk. Structure:\n" +
    "1. Anomaly status: open + critical count, est revenue leakage in ₹ Lakh.\n" +
    "2. Demand outlook: tomorrow's fleet peak hour + high-risk feeder count + forecast MAPE.\n" +
    "3. Action: specific next step (inspection priority, feeder review, or peak-hour load support).\n" +
    "Use Indian power-sector + BESCOM terms (feeder, AT&C, DT, MAPE). Under 70 words.";

  try {
    const text = await rawLLM(system, JSON.stringify(input), 200);
    writeCache(`briefing_${cacheKey}`, text);
    return text;
  } catch {
    return `${input.totalFeeders} feeders monitored. ${input.openAnomalies} open anomalies (${input.criticalAnomalies} critical) — ₹${(input.estimatedRevenueLossInr/1e5).toFixed(1)}L est leakage. Tomorrow's fleet peak ${input.fleetPeakKwh.toFixed(0)} kWh at ${String(input.fleetPeakHour).padStart(2,'0')}:00; ${input.highRiskFeeders} feeders flagged HIGH risk (forecast MAPE ${input.forecastModelMape.toFixed(0)}%).`;
  }
}

// ─── 2. Anomaly explanation (replaces template-based lib/ai.ts) ──────────
export interface AnomalyNarrateInput {
  anomalyId: string;
  type: string;                 // ZERO_CONSUMPTION_LIVE | REVERSE_FLOW | etc.
  severity: string;             // CRITICAL | HIGH | MEDIUM | LOW
  consumerName?: string | null;
  feederName?: string | null;
  evidence: Record<string, unknown>;     // structured evidence (parsed JSON)
  estimatedLossKwh?: number | null;
  estimatedRevenueLossInr?: number | null;
}

export async function explainAnomaly(input: AnomalyNarrateInput): Promise<string> {
  const cacheKey = createHash("sha256").update(input.anomalyId).digest("hex").slice(0, 16);
  const cached = readCache(`anom_${cacheKey}`);
  if (cached) return cached;

  if (!hasLLM()) {
    return `${input.severity} ${input.type.replace(/_/g, ' ')} on ${input.consumerName ?? input.feederName ?? 'asset'}. ${input.estimatedLossKwh ? `Est ${input.estimatedLossKwh.toFixed(0)} kWh leakage (₹${(input.estimatedRevenueLossInr??0).toLocaleString('en-IN')}). ` : ''}Inspect physically and reconcile billing.`;
  }

  const system =
    "You are a BESCOM AT&C (Aggregate Technical & Commercial loss) inspector writing 2 sentences:\n" +
    "1. Plain-English explanation of WHAT this anomaly means physically — translate the type code into operational meaning, citing the strongest evidence field.\n" +
    "2. Specific NEXT ACTION for the field team — what to inspect, who to dispatch, what to verify. Include the ₹/kWh impact if provided.\n" +
    "Be direct. Use BESCOM terms (DT, feeder, billing cycle). Under 50 words.";

  try {
    const text = await rawLLM(system, JSON.stringify(input), 140);
    writeCache(`anom_${cacheKey}`, text);
    return text;
  } catch {
    return `${input.severity} ${input.type.replace(/_/g, ' ')} on ${input.consumerName ?? input.feederName ?? 'asset'}. ${input.estimatedLossKwh ? `~${input.estimatedLossKwh.toFixed(0)} kWh leakage. ` : ''}Schedule on-site inspection within 48 hours.`;
  }
}

// ─── 3. Forecast/risk explanation per feeder ─────────────────────────────
export interface ForecastExplainInput {
  feederId: string;
  feederName: string;
  riskLevel: string;
  riskReason: string;
  peakKwh: number;
  peakHour: number;
  meanKwh: number;
  modelMape: number;
  improvementVsHistAvgPct: number;
}

export async function explainFeederForecast(input: ForecastExplainInput): Promise<string> {
  const cacheKey = createHash("sha256").update(`${input.feederId}_${input.riskLevel}_${input.peakKwh.toFixed(1)}`).digest("hex").slice(0, 16);
  const cached = readCache(`fcst_${cacheKey}`);
  if (cached) return cached;

  if (!hasLLM()) {
    return `${input.feederName} forecast peak ${input.peakKwh.toFixed(1)} kWh at ${String(input.peakHour).padStart(2,'0')}:00. ${input.riskReason} Forecast MAPE ${input.modelMape.toFixed(1)}%, ${input.improvementVsHistAvgPct.toFixed(0)}% better than historical-average baseline.`;
  }

  const system =
    "You are a BESCOM grid planner narrating a feeder demand forecast. Write 2 sentences:\n" +
    "1. State the forecast peak (kWh + 24-hour format hour) and what risk classification it implies.\n" +
    "2. Recommended action — feeder reinforcement, peak-shift outreach, or no-action, plus accuracy context (MAPE %).\n" +
    "Be concrete. Use BESCOM terms. Under 50 words.";

  try {
    const text = await rawLLM(system, JSON.stringify(input), 140);
    writeCache(`fcst_${cacheKey}`, text);
    return text;
  } catch {
    return `${input.feederName}: peak ${input.peakKwh.toFixed(1)} kWh at ${String(input.peakHour).padStart(2,'0')}:00. ${input.riskReason}`;
  }
}
