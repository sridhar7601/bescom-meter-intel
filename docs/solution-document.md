# MeterSense AI — BESCOM Smart Meter Intelligence & AT&C Loss Detection

**PanIIT AI for Bharat Hackathon — Theme 8 Submission**

---

## 1. Executive Summary

BESCOM (Bangalore Electricity Supply Company) supplies electricity to roughly **one crore consumers** across eight Karnataka districts. The single largest leakage in its operating P&L is **Aggregate Technical and Commercial (AT&C) loss** — the gap between energy *supplied* into a feeder and energy *billed* to the consumers it serves. Industry estimates place BESCOM's AT&C loss in the **15–20%** band, a mix of genuine technical distribution losses (line resistance, transformer inefficiency) and commercial losses (meter tampering, bypass connections, billing errors, unauthorised consumption). Detection today is largely manual, sample-based, and reactive — field officers chase customer complaints rather than proactively identifying anomalies, which means high-loss feeders can run undetected for months.

**MeterSense AI** is a single-process Next.js operations console designed for the BESCOM control room. It ingests **feeder- and consumer-level smart meter intervals** (simulated for the prototype, MDAS/HES-compatible for production), runs three complementary detection methods in parallel — **isolation-forest cohort scoring** per feeder, a **seven-class rule engine**, and **feeder reconciliation** that compares supplied versus billed kWh — and opens explainable `Anomaly` cases with evidence JSON, narrative reasoning, and a rupee revenue-gap estimate that drives prioritisation. A Tremor dashboard, Leaflet substation map with pincode choropleth, and an investigator workflow (acknowledge → investigate → resolve / mark false-positive) complete a field-ready loop. Mock-AI by default (`USE_MOCK_AI=true`) — no third-party LLM keys required for the demo.

---

## 2. Problem Deep Dive

### Pain points

- **Reactive, not proactive.** Loss anomalies are typically caught after a billing-cycle complaint or an annual reconciliation audit. By the time a tampering or bypass case surfaces, weeks of revenue have already leaked.
- **Sample-based field work.** Inspectors visit feeders on rotation. With ~thousands of feeders across BESCOM's footprint, no rotation cadence catches localised anomalies in time.
- **Opaque "loss%" headlines.** Operators see aggregate loss percentages without the per-feeder, per-consumer evidence that would let them act. AT&C loss is a board-level metric, not a workflow-actionable one.
- **No prioritisation by rupee.** When multiple feeders show loss, there's no shared view that ranks them by *estimated revenue at risk*, which is what actually decides where to send a team first.

### Stakeholders

- **Primary:** BESCOM control-room engineers, field investigators, AT&C loss reduction cell, sub-divisional engineers.
- **Secondary:** KPTCL grid operators (upstream feeder hand-off), Karnataka Electricity Regulatory Commission (compliance), state finance department (revenue accountability).

### Regulatory & deployment context

The Ministry of Power's **Revamped Distribution Sector Scheme (RDSS)** ties central funding to AT&C loss reduction milestones for every DISCOM. Karnataka's commitment under RDSS makes BESCOM's loss reduction a state-level KPI, not just an internal KPI. Smart-meter rollout under RDSS is expected to cover the bulk of urban consumers within five years; the dataset MeterSense is designed for is exactly the data that rollout will produce. The Bureau of Energy Efficiency mandates audit trails for tampering investigations — every anomaly we open carries a reconstructible evidence record.

---

## 3. Solution Architecture

### System overview

MeterSense AI is one Next.js 15 application (App Router) combining the operator UI, REST-style JSON routes under `app/api/**`, and Prisma persistence. There is no separate Python sidecar — anomaly detection runs in pure TypeScript on the Node process. SQLite is used for the prototype; the schema is PostgreSQL-portable for production.

The user journey:

1. **Dashboard (`/`)** — Tremor cards (Active Feeders, Avg Loss %, Open Anomalies by severity, Estimated Revenue Loss in ₹ Cr), AreaChart of network-wide supplied vs billed energy over 30 days, DonutChart of anomalies by type, recent-critical-anomalies feed.
2. **Map (`/map`)** — full-screen Leaflet view of Bengaluru with substation markers and pincode choropleth coloured by loss% (red >25%, amber 15–25%, green <15%).
3. **Substation drill-in (`/substations/[id]`)** — feeders table with per-feeder loss% and anomaly count plus a "Run Anomaly Detection" trigger.
4. **Feeder drill-in (`/feeders/[id]`)** — tabs for Overview (LineChart of supplied vs billed), Consumers (filterable by type), Readings (full paginated log), Anomalies (table with evidence row-expand).
5. **Anomaly review (`/anomalies/[id]`)** — full evidence card, narrative reasoning paragraph, four action buttons (Acknowledge / Investigate / Resolve / Mark False-Positive), status timeline.

### Data model

`Substation → Feeder → Consumer` hierarchy with time-series in `FeederReading` (supplied vs billed energy, computed loss kWh and loss%) and `ConsumerReading` (kWh, voltage, current, power factor, reverse-flow flag, comm status). `Anomaly` carries severity, status, score, evidence JSON, narrative reasoning, estimated kWh and rupee loss, plus optional investigator and resolution fields. Indexes on `(substationId)`, `(feederId)`, `(consumerId, timestamp)`, and `(status, severity)` keep the operator queries fast.

### Detection pipeline (the differentiator)

Three methods run in parallel and their outputs are merged into a single `Anomaly` ledger:

- **Isolation-forest cohort scoring.** Per consumer per 30-day window, feature vector = `[mean_kwh, stddev_kwh, zero_days_ratio, voltage_dropouts, reverse_flow_count, pf_mean]`. The forest is *trained per feeder cohort* so a consumer that's anomalous against its own feeder's baseline gets caught even if it would look normal against the network as a whole. This is the architectural choice that distinguishes MeterSense from generic loss-detection tools — local context matters in distribution networks where two feeders three kilometres apart can serve very different load profiles.
- **Rule engine.** Seven explicit rules: `ZERO_CONSUMPTION_LIVE` (zero kWh for 7+ days but voltage present — classic tamper signature), `REVERSE_FLOW` (back-feed, often solar mis-billing), `POWER_FACTOR_DROP` (PF < 0.6 sustained), `VOLTAGE_SAG` (< 180V for >2 hours), `METER_COMM_LOSS` (status missing > 12 hours), `BYPASS_SUSPECTED` (feeder loss > 25% AND fewer than 50% of consumers reporting meaningful energy), `TAMPER_SUSPECTED` (catch-all for tamper flags in comm status).
- **Feeder reconciliation.** Direct `lossKwh = kwhSupplied − Σ ConsumerReading.kwh` per matching window, with `lossPct = lossKwh / kwhSupplied × 100`. Configurable threshold opens reconciliation anomalies independently of the cohort or rule paths.

Every anomaly carries the metric values that triggered it (verbatim, in the `evidence` JSON), a human-readable reasoning paragraph (template-generated by `lib/ai.ts` — no LLM call, deterministic for demo reproducibility), and a rupee revenue-loss estimate that lets supervisors prioritise.

---

## 4. Tech Stack & AI Approach

| Layer | Technology | Why this choice |
|---|---|---|
| Framework | Next.js 15 App Router + TypeScript | Single-process deployment, no Python sidecar, runs on BESCOM's existing infra |
| Persistence | Prisma + SQLite (prototype), PostgreSQL-portable | One-line `DATABASE_URL` swap for production |
| Charts | Tremor (Line, Area, Bar, Donut) | Operator-grade time-series visuals out of the box |
| Maps | Leaflet + react-leaflet (OSM tiles) | No proprietary map keys, works fully offline |
| Anomaly detection | `isolation-forest` (npm), pure-TS rules, reconciliation | Three-method merge gives breadth + explainability |
| AI explanations | `lib/ai.ts` template-based, no LLM | Deterministic, demo-reproducible, no API key dependency |
| Brand palette | Amber/yellow on dark | BESCOM electrical identity, high contrast for control-room screens |

The "AI approach" is deliberately algorithmic — judged tooling like load-disaggregation neural networks would be over-engineered for a problem where physics-based reconciliation already explains most anomalies. Where natural-language explanations are useful (the reasoning paragraph), we use templates rather than calling an LLM, because the operator must trust the explanation and audit it later. A future production path could swap `lib/ai.ts` to a real LLM behind an env-var flag without changing the rest of the system.

---

## 5. Reproducibility & Demo Flow

### Setup

```bash
git clone https://github.com/sridhar7601/bescom-meter-intel.git
cd bescom-meter-intel
cp .env.example .env
npm install
npx prisma migrate deploy
npm run seed
npm run dev   # http://localhost:3000
```

- **Mock data** — `scripts/generate-mock-meter-data.ts` (Faker seed 42): 5 substations (Jayanagar, Koramangala, Whitefield, Rajajinagar, Electronic City), 20 feeders, 200 consumers, 30 days of hourly feeder readings (~14,400 rows) + 30 days of 6-hour consumer readings (~24,000 rows), with deliberate anomaly scenarios injected (3 zero-consumption-live tampers, 2 reverse-flow, 1 bypass-suspected feeder, 2 PF drops, 1 sustained comm loss, scattered voltage sags).
- **Seeding** — `scripts/seed-demo.ts` loads data and calls the same detection pipeline as `POST /api/detect/run`, producing 15–25 anomalies across severities for an immediately demoable dataset.

### Demo flow (2-minute hot path)

1. Dashboard loads with 5 substations, 20 feeders, average loss 18%, ~23 open anomalies.
2. Map view: pincode 560038 shown red → click reveals 32% loss → click Jayanagar substation marker.
3. Substation page: 4 feeders listed, one flagged critical → click through.
4. Feeder Overview: AreaChart shows visible divergence between supplied and billed energy over 14 days.
5. Anomalies tab: `BYPASS_SUSPECTED` at critical severity → row expand reveals evidence JSON (`kwhSupplied: 9800, kwhBilled: 6500, delta: 3300`) and reasoning paragraph.
6. Click Acknowledge → status updates → investigator field auto-fills (`demo-officer`) → audit timeline appends.
7. Back to dashboard: open-anomaly count decrements live.

---

## 6. Security, Ethics & Privacy

- **Synthetic data only.** No real revenue-register numbers, no live grid telemetry. All `rrNumber` values are pseudonymous.
- **Audit-trail by design.** Every anomaly status change and investigator assignment is captured. The evidence JSON is immutable once written.
- **No third-party data egress.** Default mode runs entirely on the operator's local Node process — no LLM calls, no cloud analytics. Pincode coordinates are public OSM data.
- **Authentication path.** Production deployment would put the operator console behind BESCOM's existing SSO; the prototype skips auth to keep the demo path frictionless.

---

## 7. Known Limitations & Production Roadmap

### MVP scope explicitly excludes

- Real MDAS / AMISP integration (CSV upload stub only — production needs vendor-specific drivers).
- Deep ML model training (isolation-forest with sensible defaults; production would tune per DISCOM policy).
- Mobile field-officer app (operator console is desktop-first for MVP).
- Direct billing-system integration for closed-loop revenue recovery.
- Multi-language UI (English-only for the prototype).

### Production hardening checklist

- Swap SQLite → PostgreSQL with Timescale extension for time-series compaction; partition `FeederReading` and `ConsumerReading` by month.
- Move detection runs from on-demand `/api/detect/run` to a scheduled job (BullMQ/Redis queue with feeder-level sharding).
- Calibrate isolation-forest thresholds per substation using six months of historical data; surface model-version history (already supported by the schema).
- Replace simplified pincode envelopes in the choropleth with BESCOM's actual sub-division GeoJSON.
- Add reviewer roles, SLA timers on critical anomalies, and Slack/SMS alerting for severity = `CRITICAL`.

---

## 8. Conclusion

MeterSense AI demonstrates a credible BESCOM control-room loop: time-series ingestion at feeder and consumer depth, triple-method anomaly detection (isolation forest + rules + reconciliation), AT&C-loss framing in operator language, explainable evidence per case, geographic heatmap for triage, and an investigator workflow that reduces "open anomalies" through verifiable status changes. The architecture is deliberately deployment-friendly — single Node process, PostgreSQL-portable Prisma schema, no Python sidecar, no proprietary map keys, no mandatory LLM dependency — so the path from this prototype to a BESCOM-internal pilot is environment configuration, not re-architecture.

The differentiator versus generic loss-detection tooling: every anomaly is **explainable** (evidence JSON + reasoning), **prioritised** (rupee revenue-loss estimate), and **actionable** (operator workflow with audit trail). That combination is what turns AT&C loss from a board-level KPI into a daily-actionable workflow — which is the only way the RDSS-mandated reduction targets actually get hit.
