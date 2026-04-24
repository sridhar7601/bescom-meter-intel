export const FeederType = {
  HT_11KV: "HT_11KV",
  LT_415V: "LT_415V",
  MIXED: "MIXED",
} as const;
export type FeederType = (typeof FeederType)[keyof typeof FeederType];

export const ConsumerType = {
  DOMESTIC: "DOMESTIC",
  COMMERCIAL: "COMMERCIAL",
  INDUSTRIAL: "INDUSTRIAL",
  AGRICULTURAL: "AGRICULTURAL",
  STREETLIGHT: "STREETLIGHT",
  PUBLIC_WATER: "PUBLIC_WATER",
} as const;
export type ConsumerType = (typeof ConsumerType)[keyof typeof ConsumerType];

export const AnomalyType = {
  TAMPER_SUSPECTED: "TAMPER_SUSPECTED",
  ZERO_CONSUMPTION_LIVE: "ZERO_CONSUMPTION_LIVE",
  REVERSE_FLOW: "REVERSE_FLOW",
  BYPASS_SUSPECTED: "BYPASS_SUSPECTED",
  POWER_FACTOR_DROP: "POWER_FACTOR_DROP",
  VOLTAGE_SAG: "VOLTAGE_SAG",
  METER_COMM_LOSS: "METER_COMM_LOSS",
} as const;
export type AnomalyType = (typeof AnomalyType)[keyof typeof AnomalyType];

export const AnomalySeverity = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  INFO: "INFO",
} as const;
export type AnomalySeverity = (typeof AnomalySeverity)[keyof typeof AnomalySeverity];

export const AnomalyStatus = {
  OPEN: "OPEN",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  INVESTIGATING: "INVESTIGATING",
  RESOLVED: "RESOLVED",
  FALSE_POSITIVE: "FALSE_POSITIVE",
} as const;
export type AnomalyStatus = (typeof AnomalyStatus)[keyof typeof AnomalyStatus];
