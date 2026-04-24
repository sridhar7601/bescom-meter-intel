"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";

type Row = {
  id: string;
  type: string;
  severity: string;
  status: string;
  detectedAt: string;
  evidence: string;
  reasoning: string;
  feeder?: string;
  pincode?: string;
};

const sev = (s: string) => {
  if (s === "CRITICAL") return "bg-red-100 text-red-800";
  if (s === "HIGH") return "bg-orange-100 text-orange-800";
  if (s === "MEDIUM") return "bg-amber-100 text-amber-800";
  return "bg-stone-100 text-stone-700";
};

export function AnomalyTable({ initial }: { initial: Row[] }) {
  const [t, setT] = useState("");
  const [s, setS] = useState("");
  const [st, setSt] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    return initial.filter((r) => {
      if (t && r.type !== t) return false;
      if (s && r.severity !== s) return false;
      if (st && r.status !== st) return false;
      return true;
    });
  }, [initial, t, s, st]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <label className="text-stone-600">
          Type{" "}
          <select
            className="ml-1 rounded border border-amber-200 bg-white"
            value={t}
            onChange={(e) => setT(e.target.value)}
          >
            <option value="">all</option>
            {[...new Set(initial.map((x) => x.type))].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="text-stone-600">
          Severity{" "}
          <select
            className="ml-1 rounded border border-amber-200 bg-white"
            value={s}
            onChange={(e) => setS(e.target.value)}
          >
            <option value="">all</option>
            {["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="text-stone-600">
          Status{" "}
          <select
            className="ml-1 rounded border border-amber-200 bg-white"
            value={st}
            onChange={(e) => setSt(e.target.value)}
          >
            <option value="">all</option>
            {["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-amber-100">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-amber-50">
            <tr>
              <th className="px-2 py-2">When</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Sev</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Feeder</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-t border-amber-100">
                  <td className="px-2 py-1 font-mono text-xs text-stone-500">{r.detectedAt}</td>
                  <td className="px-2 py-1">{r.type.replace(/_/g, " ")}</td>
                  <td className="px-2 py-1">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${sev(r.severity)}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-2 py-1">{r.status}</td>
                  <td className="px-2 py-1 font-mono text-xs">{r.feeder ?? "—"}</td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      className="text-amber-800 underline"
                      onClick={() => setOpen(open === r.id ? null : r.id)}
                    >
                      {open === r.id ? "Hide" : "Expand"}
                    </button>
                    <Link className="ml-2 text-amber-800 underline" href={`/anomalies/${r.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
                {open === r.id ? (
                  <tr className="bg-amber-50/50">
                    <td colSpan={6} className="px-3 py-2 text-xs text-stone-700">
                      <p className="font-semibold text-amber-900">Evidence (JSON)</p>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-white p-2 text-[11px]">
                        {r.evidence}
                      </pre>
                      <p className="mt-2 font-semibold text-amber-900">Reasoning</p>
                      <p>{r.reasoning}</p>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
