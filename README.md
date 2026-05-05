# MeterSense AI — BESCOM Smart Meter Intelligence + Loss Detection

> **PanIIT AI for Bharat Hackathon — Theme 8**
> Smart-meter decision support: localized hourly demand prediction + AT&C loss / theft detection, with **Azure GPT-4.1** narration grounded on real numbers.

---

## What it solves

The brief has **two parts**, both addressed:

### Part A — Localized Demand Prediction
- **24h hourly forecast per feeder** using seasonal-naive (4-week lookback at same dayOfWeek+hour) × recent trend correction
- **High-risk zone classification** — feeders forecast to exceed 130% of historical mean → HIGH risk
- **Baseline comparison** — back-tested against historical-average + persistence baselines (brief criterion)
- **Confidence band** — ±1.96σ from seasonal samples

### Part B — Anomaly & Theft Detection
- **Isolation forest** per-feeder cohort with 6-dim feature vector (mean/std kWh, zero-days ratio, voltage dropouts, reverse-flow count, PF mean)
- **6 explicit rule detectors**: ZERO_CONSUMPTION_LIVE, REVERSE_FLOW, POWER_FACTOR_DROP, VOLTAGE_SAG, METER_COMM_LOSS, TAMPER_SUSPECTED
- **Feeder reconciliation** — supplied vs Σ billed kWh; bypass flagged at >25% loss + <50% active
- **Severity tiers**: CRITICAL ≥0.65, HIGH ≥0.55, MEDIUM ≥0.45 (isolation forest score)
- **5-state workflow**: OPEN → ACKNOWLEDGED → INVESTIGATING → RESOLVED / FALSE_POSITIVE

**Brief non-negotiables met:** synthetic data only, no hosted-LLM on real meter data, deterministic explainable detection, decision-support layer (no system writes).

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |

No Python. No Docker. SQLite is bundled.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create `.env.local`:

```env
# Required for AI features (briefing, anomaly explanations, forecast narration)
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2025-01-01-preview

# Optional fallback if Azure not available
# OPENAI_API_KEY=sk-...
```

> **Without API keys:** the app runs fully — every AI block falls back to deterministic templates. All forecasting, isolation forest, rules, reconciliation, charts work offline.

### 3. Database + seed

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
```

Seeds:
- **5 substations · 20 feeders · 200 consumers**
- **30 days of hourly feeder readings** (kwhSupplied, kwhBilled, lossPct)
- **6 hours of consumer readings** (kwh, voltage, current, power factor, reverse flow flag, comm status)
- **Synthetic anomalies injected** (zero-consumption, reverse-flow, bypass, PF drops, comm-loss)

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Full setup (one-liner)

```bash
npm install && npx prisma generate && npx prisma migrate dev --name init && npm run seed && npm run dev
```

---

## Key features

| Feature | Where |
|---------|-------|
| **AI Morning Briefing** (Azure GPT-4.1) | Dashboard — top card |
| **24h hourly demand forecast** + risk zones (HIGH / MEDIUM / NORMAL) | `/forecasting` |
| **Baseline comparison** (vs historical-avg + persistence) | `/forecasting` |
| **AI feeder narration** for top-5 risk feeders | `/forecasting` |
| Isolation forest + 6 rule detectors + reconciliation | `/anomalies` |
| **AI Inspector Recommendation** per anomaly (Azure GPT-4.1) | `/anomalies/[id]` |
| 5-state anomaly workflow (OPEN → INVESTIGATING → RESOLVED / FP) | `/anomalies/[id]` |
| Substation map (Leaflet + OSM) with loss% choropleth | `/map` |
| Feeder detail tabs (overview, consumers, readings, anomalies) | `/feeders/[id]` |
| `POST /api/detect/run` — trigger full detection pipeline | API |

---

## Available scripts

```bash
npm run dev         # Start dev server (Next.js)
npm run build       # Production build
npm run start       # Start production server
npm run typecheck   # TypeScript check
npm run lint        # ESLint
npm run seed        # Reset + seed demo data (Faker seed 42)
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Database | Prisma 5 + SQLite (PostgreSQL-portable) |
| ML | isolation-forest npm + custom seasonal-naive forecaster |
| Charts | @tremor/react |
| Map | Leaflet + react-leaflet (OSM) |
| AI / LLM | Azure OpenAI GPT-4.1 (enterprise) — fully optional |
| Styling | Tailwind CSS v3 + lucide-react icons |
| Data | Faker 10 (seed 42) — deterministic |

---

## Architecture

```
app/
├── page.tsx                    Dashboard — AI briefing, KPIs, supplied-vs-billed, map
├── forecasting/                Part A: hourly forecast + baselines + risk classification
├── anomalies/                  Anomaly ledger
│   └── [id]/                   Single anomaly with AI inspector recommendation
├── map/                        Full-screen substation map with loss% choropleth
├── feeders/[id]/               Tabbed feeder view: overview, consumers, readings, anomalies
├── substations/[id]/           Substation detail
└── api/                        15 endpoints (anomalies, feeders, detect/run, dashboard, etc.)

lib/
├── demand-forecast.ts          24h hourly per-feeder forecast (seasonal-naive + trend)
├── baselines.ts                Hist-avg + persistence baseline back-test
├── llm-narration.ts            Azure GPT-4.1 grounded narration (3 use cases, disk-cached)
├── detectors/
│   ├── isolationForest.ts      Per-cohort outlier detection (6-dim features)
│   ├── rules.ts                6 explicit rule detectors
│   ├── feederReconciliation.ts Supplied vs billed bypass detection
│   └── runAll.ts               Orchestrator with dedup
├── ai.ts                       Legacy template explainer (kept as fallback)
└── db.ts                       Prisma client
```

---

## How AI is used (Azure GPT-4.1)

All AI outputs are **grounded** — GPT-4.1 only describes pre-computed numbers (forecast kWh, anomaly evidence fields, MAPE %). No hallucinated values. Every response cached to `data/llm-cache/` after first call → demo never breaks if network is down.

| Use case | Where |
|----------|-------|
| **Morning briefing** | Dashboard — anomaly status + demand outlook + recommended action |
| **Feeder forecast narration** | `/forecasting` — peak + risk + reinforcement vs no-action |
| **Anomaly inspector recommendation** | `/anomalies/[id]` — what to inspect, dispatch action |

Production note: per the brief's non-negotiables, hosted-LLM on real BESCOM customer data is not permitted. This implementation uses synthetic demo data only. The `lib/llm-narration.ts` interface is model-agnostic — production swaps Azure for on-prem inference (Llama-3 / Mistral) without changing application code.

---

## Methodology — Part A (Demand & Risk)

**Forecast model:**
```
forecast[h] = mean(last 4 weeks at same dayOfWeek+hour) × trend_factor
trend_factor = mean(last 7 days) / mean(all history)   [clamped 0.6–1.6]
band[h] = forecast[h] ± 1.96 × σ(seasonal_samples)
```

**Risk classification:**
- HIGH: peak ≥ 130% of 30-day mean OR recent 7-day load ≥ 125% of all-history mean
- MEDIUM: peak ≥ 110% of mean OR trend ≥ 110%
- NORMAL: otherwise

**Back-test on hold-out:**
- Held out: last 24 hours of each feeder
- Trained on: prior data (3+ weeks)
- Metric: MAPE % — compared against (a) hist-avg baseline (b) persistence (last week same hour)
- Brief criterion: "comparable against simple baselines such as historical averages" → fully implemented

---

## Methodology — Part B (Anomaly & Theft)

**Isolation forest (per-feeder cohort):**
- 64 trees, sample size min(256, N)
- 6-dim feature vector: meanKwh, stdKwh, zeroDaysRatio, voltageDropouts, reverseFlowCount, powerFactorMean
- Severity from anomaly score (higher = more outlier): CRITICAL ≥0.65, HIGH ≥0.55, MEDIUM ≥0.45
- Fallback: z-score if cohort < 5 consumers

**Rule detectors (6):**
- `ZERO_CONSUMPTION_LIVE`: 7d flat kWh + voltage present → live bypass
- `REVERSE_FLOW`: ≥2 reverse flow flags in window
- `POWER_FACTOR_DROP`: PF < 0.6 sustained
- `VOLTAGE_SAG`: V < 180 for >2h
- `METER_COMM_LOSS`: comm status missing >12h
- `TAMPER_SUSPECTED`: tamper flag + low energy

**Feeder reconciliation:**
- bypass flagged if loss% > 25% AND active consumers < 50%
- Evidence: kwhSupplied, Σ kwhBilled, active consumer count, loss%

---

## Model & architecture choices (and why)

| Choice | Reason |
|--------|--------|
| **Seasonal-naive forecaster** instead of Prophet/LSTM | Deterministic, auditable, runs in <50ms, no GPU, no training data drift. The forecast() interface is a drop-in for any trained model. |
| **Isolation forest + rules** instead of single deep model | Brief asks for *false positive minimization* — rules catch known patterns deterministically; isolation forest catches statistical outliers. Together they triangulate; a single DL model can't be audited. |
| **Azure OpenAI GPT-4.1** for narration only — never for math | LLMs hallucinate numbers. We pre-compute every kWh, ₹, MAPE, then ask GPT-4.1 only to describe them. Zero invented values. |
| **SQLite for demo, PostgreSQL portable** | One-line schema change (`provider = "postgresql"`); existing Prisma queries unchanged. |
| **No hosted-LLM on real data in production** | Brief non-negotiable. `lib/llm-narration.ts` is model-agnostic — swap URL + auth header for on-prem Llama-3 / Mistral. |

---

## Risks & mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **No real MDAS/HES feed** | Forecast accuracy on real meter data | Heuristic curves are placeholder; production swaps for telemetry. The forecast interface accepts any pre-computed series. |
| **False positives in anomaly detection** | Inspector wasted trips | Two-layer detection (rules + isolation forest); only ones agreed on by both surface as CRITICAL. Inspector can mark FP → fed back into model retraining. |
| **Data quality — gaps, missing readings** | Forecast / detection blind spots | Seasonal-naive tolerates gaps (uses available samples); METER_COMM_LOSS rule actively flags gaps as anomalies. |
| **LLM hallucination** | Operators trust wrong numbers | All AI narration is grounded — GPT-4.1 only describes pre-computed values. Disk-cached; deterministic fallback if API down. |
| **Sensitive data leakage** | Compliance / brief non-negotiable | Synthetic-only in repo (Faker seed 42). Production swaps to on-prem inference. |
| **Threshold drift** | Misclassification | Production calibrates per-substation; thresholds exposed as env vars. |
| **Load growth changes baseline** | Forecast obsolescence | Trend factor adapts (last 7-day vs all-history ratio); seasonal samples roll forward automatically. |

---

## Implementation roadmap (90-day BESCOM pilot)

**Phase 1 — Data integration (weeks 1–4)**
- Replace Faker seed with BESCOM MDAS/HES export (CSV → API)
- Map real feeder codes; calibrate severity thresholds per substation
- Output: same UI, real numbers behind it

**Phase 2 — Pilot rollout (weeks 5–8)**
- Run pipeline on 1 division (~20 feeders, ~5000 consumers)
- Field team verifies top-20 anomalies; tag false positives
- Output: validated detection precision/recall

**Phase 3 — Forecast validation (weeks 9–12)**
- Validate forecast MAPE on real telemetry
- Tune trend factor + seasonal lookback per feeder type
- Output: production MAPE benchmark, retrain cadence

**Phase 4 — Production hardening (post-pilot)**
- SQLite → PostgreSQL/TimescaleDB
- Azure OpenAI → on-prem Llama-3 (per non-negotiable)
- CI/CD, monitoring, role-based auth (BESCOM SSO)
- Mobile field app for inspectors

**Cost estimates**
- Single VM (dev/pilot): ₹6,000/month
- Azure OpenAI (cached, low call volume): ₹1,000/month
- Production fleet (1000s of feeders, 100k consumers): ₹50,000/month managed PostgreSQL + 3 VMs

---

## Submission

- **Hackathon:** PanIIT AI for Bharat
- **Theme:** 8 — AI for Smart Meter Intelligence & Loss Detection (BESCOM)
- **Team:** Sridhar, Sruthi
