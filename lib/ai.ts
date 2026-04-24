import "dotenv/config";
import type { AnomalyType } from "@/lib/enums";

type EvidenceShape = {
  [key: string]: string | number | boolean | null | undefined;
};

export async function explainAnomaly(
  type: AnomalyType,
  evidence: string,
  locale = "en-IN"
): Promise<string> {
  if (process.env.USE_MOCK_AI !== "false") {
    return mockExplainAnomaly(type, evidence, locale);
  }
  throw new Error("Real AI not implemented — set USE_MOCK_AI=true for demo");
}

function tryParse(evidence: string): EvidenceShape {
  try {
    return JSON.parse(evidence) as EvidenceShape;
  } catch {
    return { raw: evidence };
  }
}

function mockExplainAnomaly(
  type: AnomalyType,
  evidence: string,
  locale: string
): string {
  const e = tryParse(evidence);
  const lines: string[] = [];
  const loss = e.estimatedLossKwh != null ? `Estimated unaccounted energy: ${e.estimatedLossKwh} kWh.` : "";
  const rev = e.estimatedRevenueInr != null ? `Implied commercial gap at ₹6/kWh: ₹${e.estimatedRevenueInr}.` : "";

  switch (type) {
    case "ZERO_CONSUMPTION_LIVE":
      lines.push(
        `BESCOM field pattern (${locale}): meters report healthy voltage and connectivity while cumulative kWh stays flat. This usually indicates a live bypass or tamper before the meter element. ${loss}`
      );
      break;
    case "REVERSE_FLOW":
      lines.push(
        "Reverse power flow is flagged on one or more intervals — consistent with solar net-metering, generator backfeed, or CT polarity errors. Reconcile with sanctioned DG before billing recovery."
      );
      break;
    case "POWER_FACTOR_DROP":
      lines.push("Sustained power factor below 0.6 often tracks with harmonic-heavy loads, stuck capacitor banks, or measurement degradation at the HES; coordinate HT inspection.");
      break;
    case "VOLTAGE_SAG":
      lines.push("Sustained low voltage without matching load relief suggests upstream impedance or neutral issues; compare with DTR tap settings and neighbor complaints in the 11kV area.");
      break;
    case "METER_COMM_LOSS":
      lines.push("HES/MDAS gaps exceed policy thresholds. Prioritize truck-roll or RF mesh fixes — regulatory compliance requires comm visibility before tamper adjudication.");
      break;
    case "BYPASS_SUSPECTED":
      lines.push(
        `Feeder reconciliation shows AT&C loss well above the peer cohort; combined with under-reporting on downstream meters, a physical bypass is suspected. ${loss} ${rev}`
      );
      break;
    case "TAMPER_SUSPECTED":
      lines.push(
        "Isolation-forest and peer-normalization show this service point as a multivariate outlier across energy, comm, and power quality — consistent with a tamper signature pending physical seal inspection."
      );
      break;
    default:
      lines.push("Rule engine flagged an anomaly. Review the evidence JSON and align with the DISCOM investigation playbook.");
  }
  return lines.join(" ");
}
