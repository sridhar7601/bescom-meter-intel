# MeterSense AI — BESCOM smart meter intelligence

Operational dashboard for BESCOM engineers: feeder and consumer time-series, **AT&C (aggregate technical & commercial) loss** visibility, **isolation-forest** cohort anomalies, **rule-based** detection (seven types), and **feeder reconciliation** (supplied vs billed) with **explainable** evidence and investigator workflow. Maps use **Leaflet**; metrics use **Tremor** on **Next.js 15** + **Prisma (SQLite)** + **Tailwind v3**.

> **PanIIT AI for Bharat Hackathon** — Theme 8: AI for Smart Meter Intelligence & Loss Detection (BESCOM)

## Quick start

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

Open **http://localhost:3000**.

## Demo data

- `scripts/generate-mock-meter-data.ts` — 5 substations (Jayanagar, Koramangala, Whitefield, Rajajinagar, Electronic City), 20 feeders, 200 consumers, 30d hourly/6h readings, injected edge cases.  
- `scripts/seed-demo.ts` — wipes and loads data, then runs the same detection as `POST /api/detect/run` (~15–25 anomalies expected).

## Architecture

See [docs/solution-document.md](docs/solution-document.md) and [docs/diagrams/architecture.png](docs/diagrams/architecture.png) (Mermaid: `docs/diagrams/architecture.mmd`).

## Tech stack

- Next.js 15 (App Router) · TypeScript  
- Prisma 5 + SQLite  
- Tailwind CSS v3 · Tremor · lucide (optional) · Leaflet + react-leaflet  
- `isolation-forest` (JS) for cohort scoring; template `lib/ai.ts` when `USE_MOCK_AI=true` (default)

## Verification (gates)

```bash
npm install
npm run build
npx tsc --noEmit
npm run seed
npm run dev   # then curl http://localhost:3000
```

## Documentation

- [docs/solution-document.md](docs/solution-document.md)  
- [docs/solution-document.pdf](docs/solution-document.pdf)

## Remote

```text
https://github.com/sridhar7601/bescom-meter-intel.git
```

(Use a plain `https` URL — do not embed tokens in the remote URL.)

## Known limitations

Synthetic data only; CSV upload is a stub; pincode shapes are simplified for the choropleth demo.
