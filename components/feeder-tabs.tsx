"use client";

import { useState } from "react";
import Link from "next/link";
import { LineChart, Card, Title, Text } from "@tremor/react";

type Tab = "overview" | "consumers" | "readings" | "anomalies";

type SeriesRow = { t: string; kwhSupplied: number; kwhBilled: number; lossPct: number };
type ConsumerRow = {
  id: string;
  rrNumber: string;
  name: string;
  type: string;
  sanctionedLoad: number;
  pincode: string;
};
type ReadingRow = { t: string; kwhSupplied: number; kwhBilled: number; lossKwh: number; lossPct: number };
type AnomRow = {
  id: string;
  type: string;
  severity: string;
  status: string;
  detectedAt: string;
};

export function FeederTabs(props: {
  feederId: string;
  lineData: SeriesRow[];
  breakdown: { technicalLossPct: number; commercialLossPct: number; atcLossPct: number };
  consumers: ConsumerRow[];
  readings: ReadingRow[];
  anomalies: AnomRow[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const line = props.lineData.slice(-72).map((r) => ({
    h: r.t.slice(5, 16),
    Supplied: r.kwhSupplied,
    Billed: r.kwhBilled,
  }));
  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-amber-200 pb-2">
        {(
          [
            ["overview", "Overview"],
            ["consumers", "Consumers"],
            ["readings", "Readings"],
            ["anomalies", "Anomalies"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              tab === k
                ? "rounded-md bg-amber-200 px-3 py-1.5 text-sm font-medium text-amber-900"
                : "rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-amber-50"
            }
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <div className="mt-4 space-y-4">
          <Card>
            <Title>Supplied vs billed (recent hours)</Title>
            <LineChart
              className="mt-4 h-80"
              data={line}
              index="h"
              categories={["Supplied", "Billed"]}
              colors={["amber", "yellow"]}
            />
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <Text>Technical loss (est.)</Text>
              <p className="text-2xl font-semibold text-amber-800">{props.breakdown.technicalLossPct}%</p>
            </Card>
            <Card>
              <Text>Commercial loss (est.)</Text>
              <p className="text-2xl font-semibold text-amber-800">{props.breakdown.commercialLossPct}%</p>
            </Card>
            <Card>
              <Text>AT&amp;C (combined)</Text>
              <p className="text-2xl font-semibold text-amber-900">{props.breakdown.atcLossPct}%</p>
            </Card>
          </div>
        </div>
      ) : null}
      {tab === "consumers" ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-amber-100">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-amber-50">
              <tr>
                <th className="px-3 py-2">RR</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">kW</th>
                <th className="px-3 py-2">Pincode</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {props.consumers.map((c) => (
                <tr key={c.id} className="border-t border-amber-100">
                  <td className="px-3 py-2 font-mono text-xs">{c.rrNumber}</td>
                  <td className="px-3 py-2">{c.type}</td>
                  <td className="px-3 py-2">{c.sanctionedLoad.toFixed(1)}</td>
                  <td className="px-3 py-2">{c.pincode}</td>
                  <td className="px-3 py-2">
                    <Link className="text-amber-800 underline" href={`/consumers/${c.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "readings" ? (
        <div className="mt-4 max-h-[480px] overflow-auto rounded-lg border border-amber-100 text-xs">
          <table className="min-w-full text-left">
            <thead className="sticky top-0 bg-amber-50">
              <tr>
                <th className="px-2 py-1">Time</th>
                <th className="px-2 py-1">kWh in</th>
                <th className="px-2 py-1">kWh out</th>
                <th className="px-2 py-1">Loss kWh</th>
                <th className="px-2 py-1">Loss %</th>
              </tr>
            </thead>
            <tbody>
              {props.readings.map((r) => (
                <tr key={r.t} className="border-t border-amber-50">
                  <td className="px-2 py-1 font-mono">{r.t}</td>
                  <td className="px-2 py-1">{r.kwhSupplied.toFixed(1)}</td>
                  <td className="px-2 py-1">{r.kwhBilled.toFixed(1)}</td>
                  <td className="px-2 py-1">{r.lossKwh.toFixed(1)}</td>
                  <td className="px-2 py-1">{r.lossPct.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "anomalies" ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-amber-50">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {props.anomalies.map((a) => (
                <tr key={a.id} className="border-t border-amber-100">
                  <td className="px-3 py-2">{a.type.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2">{a.severity}</td>
                  <td className="px-3 py-2">{a.status}</td>
                  <td className="px-3 py-2">
                    <Link className="text-amber-800 underline" href={`/anomalies/${a.id}`}>
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
