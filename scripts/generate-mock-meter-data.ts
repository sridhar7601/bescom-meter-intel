import { faker } from "@faker-js/faker";
import { ConsumerType, type ConsumerType as CT, FeederType, type FeederType as FT } from "../lib/enums";
import { randomBytes } from "crypto";

faker.seed(42);

const HOUR = 60 * 60 * 1000;
const SIX = 6 * HOUR;
const DAYS = 30;
const HOURS = DAYS * 24;
const N_BLOCKS = (DAYS * 24) / 6;

const SUBS = [
  { name: "Jayanagar Sub-division", code: "S-JN-01", division: "South", lat: 12.925, lng: 77.5938, pin: "560041" },
  { name: "Koramangala Sub-division", code: "S-KM-01", division: "South", lat: 12.9352, lng: 77.6245, pin: "560034" },
  { name: "Whitefield Sub-division", code: "E-WF-01", division: "East", lat: 12.9698, lng: 77.75, pin: "560066" },
  { name: "Rajajinagar Sub-division", code: "W-RJ-01", division: "West", lat: 12.9988, lng: 77.55, pin: "560010" },
  { name: "Electronic City Sub-division", code: "S-EC-01", division: "South", lat: 12.8456, lng: 77.6603, pin: "560100" },
] as const;

const FEEDER_TYPES: FT[] = [FeederType.HT_11KV, FeederType.LT_415V, FeederType.MIXED, FeederType.LT_415V];
const C_TYPES: CT[] = [
  ConsumerType.DOMESTIC,
  ConsumerType.COMMERCIAL,
  ConsumerType.INDUSTRIAL,
  ConsumerType.AGRICULTURAL,
  ConsumerType.STREETLIGHT,
  ConsumerType.PUBLIC_WATER,
];

function cuid() {
  return "c" + randomBytes(12).toString("base64url").replace(/[^a-z0-9]/gi, "");
}

function defaultStart() {
  const end = new Date();
  end.setMinutes(0, 0, 0);
  return new Date(end.getTime() - DAYS * 24 * HOUR);
}

type GenConsumer = {
  id: string;
  feederId: string;
  rrNumber: string;
  name: string;
  type: CT;
  sanctionedLoad: number;
  pincode: string;
  lat: number;
  lng: number;
  role:
    | "normal"
    | "zero_cons"
    | "reverse"
    | "low_pf"
    | "comm_loss"
    | "voltage_sag"
    | "bypass_cohort";
};

type GenFeeder = { id: string; substationId: string; code: string; name: string; type: FT; capacityKW: number };
type GenSub = { id: string; code: string; name: string; division: string; lat: number; lng: number };

export type Generated = {
  substations: GenSub[];
  feeders: GenFeeder[];
  consumers: GenConsumer[];
  consumerReadings: Array<{
    id: string;
    consumerId: string;
    timestamp: Date;
    kwh: number;
    voltage: number;
    current: number;
    powerFactor: number;
    reverseFlow: boolean;
    commStatus: string;
  }>;
  feederReadings: Array<{
    id: string;
    feederId: string;
    timestamp: Date;
    kwhSupplied: number;
    kwhBilled: number;
    lossKwh: number;
    lossPct: number;
  }>;
};

export function generateMockMeterData(anchor: Date = defaultStart()): Generated {
  const START = anchor;
  const substations: GenSub[] = SUBS.map((s) => ({
    id: cuid(),
    code: s.code,
    name: s.name,
    division: s.division,
    lat: s.lat,
    lng: s.lng,
  }));

  const feeders: GenFeeder[] = [];
  substations.forEach((sub, si) => {
    for (let f = 0; f < 4; f++) {
      const idx = si * 4 + f;
      feeders.push({
        id: cuid(),
        substationId: sub.id,
        code: `FDR-${sub.code.split("-")[1]}-${String(idx + 1).padStart(3, "0")}`,
        name: `${sub.name.split(" ")[0]} Feeder ${f + 1}`,
        type: FEEDER_TYPES[f % FEEDER_TYPES.length]!,
        capacityKW: 800 + f * 120 + si * 50,
      });
    }
  });

  const BYPASS_INDEX = 7;
  const bypassFeederId = feeders[BYPASS_INDEX]!.id;
  const consumers: GenConsumer[] = [];
  const pincodes = ["560041", "560034", "560038", "560066", "560010", "560100", "560103", "560075"];

  feeders.forEach((feeder, fi) => {
    for (let c = 0; c < 10; c++) {
      const id = cuid();
      const pin = pincodes[(fi + c) % pincodes.length]!;
      const latJ = SUBS[fi % SUBS.length]!.lat + (faker.number.float({ min: -0.04, max: 0.04, fractionDigits: 5 }) ?? 0);
      const lngJ = SUBS[fi % SUBS.length]!.lng + (faker.number.float({ min: -0.04, max: 0.04, fractionDigits: 5 }) ?? 0);
      let role: GenConsumer["role"] = "normal";
      if (feeder.id === bypassFeederId && c >= 4) role = "bypass_cohort";
      consumers.push({
        id,
        feederId: feeder.id,
        rrNumber: `RR-${String(fi * 10 + c + 1).padStart(6, "0")}`,
        name: `Consumer ${faker.person.lastName()}`,
        type: C_TYPES[(fi + c) % C_TYPES.length]!,
        sanctionedLoad: 2 + (c % 5) * 1.1,
        pincode: pin,
        lat: latJ,
        lng: lngJ,
        role,
      });
    }
  });

  const zIdx = [0, 5, 12];
  zIdx.forEach((i) => {
    if (consumers[i]) consumers[i]!.role = "zero_cons";
  });
  if (consumers[25]) consumers[25]!.role = "reverse";
  if (consumers[40]) consumers[40]!.role = "reverse";
  if (consumers[18]) consumers[18]!.role = "low_pf";
  if (consumers[60]) consumers[60]!.role = "low_pf";
  if (consumers[33]) consumers[33]!.role = "comm_loss";
  if (consumers[90]) consumers[90]!.role = "voltage_sag";

  const consumerBlocks = new Map<string, number[]>();
  for (const c of consumers) {
    const arr: number[] = [];
    for (let b = 0; b < N_BLOCKS; b++) {
      const t = 0.5 + (c.sanctionedLoad / 12) * (0.7 + 0.6 * (faker.number.float({ min: 0, max: 1, fractionDigits: 3 }) ?? 0.5));
      arr.push(t);
    }
    consumerBlocks.set(c.id, arr);
  }
  for (const c of consumers) {
    if (c.role === "bypass_cohort" && c.feederId === bypassFeederId) {
      const arr = consumerBlocks.get(c.id)!;
      for (let b = 0; b < N_BLOCKS; b++) {
        arr[b] = b % 20 === 0 ? 0.12 : 0;
      }
    }
  }

  const consumerReadings: Generated["consumerReadings"] = [];
  for (const c of consumers) {
    const kwhB = consumerBlocks.get(c.id)!;
    for (let b = 0; b < N_BLOCKS; b++) {
      const ts = new Date(START.getTime() + b * SIX);
      let kwh = kwhB[b] ?? 0;
      let voltage = 220 + 10 * Math.sin(b / 5);
      let current = 8 + c.sanctionedLoad;
      let powerFactor = 0.85 + 0.1 * (b % 5) * 0.01;
      let reverseFlow = false;
      let comm: string = "ok";
      if (c.role === "zero_cons" && b >= N_BLOCKS - 28) {
        kwh = 0;
        voltage = 232;
        powerFactor = 0.9;
        current = 0.1;
      }
      if (c.role === "reverse" && b % 11 === 0) {
        reverseFlow = true;
        kwh = -Math.max(0.1, kwh);
      }
      if (c.role === "low_pf" && b % 3 !== 0) {
        powerFactor = 0.5;
        kwh = kwh * 0.3;
      }
      if (c.role === "comm_loss" && b > 20 && b < 32) {
        comm = "missing";
        if (b % 2 === 0) kwh = 0;
        voltage = 0;
      }
      if (c.role === "voltage_sag" && b > 6 && b < 12) {
        voltage = 165;
      }
      consumerReadings.push({
        id: cuid(),
        consumerId: c.id,
        timestamp: ts,
        kwh,
        voltage,
        current,
        powerFactor,
        reverseFlow,
        commStatus: comm,
      });
    }
  }

  const feederReadings: Generated["feederReadings"] = [];
  for (const f of feeders) {
    for (let h = 0; h < HOURS; h++) {
      const ts = new Date(START.getTime() + h * HOUR);
      const cons = consumers.filter((c) => c.feederId === f.id);
      const block = Math.floor(h / 6);
      let billed = 0;
      for (const c of cons) {
        const arr = consumerBlocks.get(c.id)!;
        const kb = arr[block] ?? 0;
        billed += kb / 6;
      }
      const baseLoss = f.id === bypassFeederId ? 0.32 : 0.04 + 0.01 * (h % 9);
      const supplied = Math.max(0, billed * (1 + baseLoss) + 2 * Math.sin(h / 12));
      const lossKwh = Math.max(0, supplied - billed);
      const lossPct = supplied > 0 ? (lossKwh / supplied) * 100 : 0;
      feederReadings.push({
        id: cuid(),
        feederId: f.id,
        timestamp: ts,
        kwhSupplied: supplied,
        kwhBilled: billed,
        lossKwh,
        lossPct,
      });
    }
  }

  return { substations, feeders, consumers, consumerReadings, feederReadings };
}
