"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Filter, ChevronRight, ChevronDown, ExternalLink } from "lucide-react";

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

function sevColor(s: string) {
  if (s === "CRITICAL") return "bg-red-600 text-white";
  if (s === "HIGH") return "bg-orange-500 text-white";
  if (s === "MEDIUM") return "bg-amber-400 text-amber-950";
  if (s === "LOW") return "bg-yellow-200 text-yellow-900";
  return "bg-stone-200 text-stone-700";
}

function statusColor(s: string) {
  switch (s) {
    case "OPEN":
      return "bg-red-50 text-red-700 border-red-200";
    case "ACKNOWLEDGED":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "INVESTIGATING":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "RESOLVED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "FALSE_POSITIVE":
      return "bg-stone-50 text-stone-600 border-stone-200";
    default:
      return "bg-stone-50 text-stone-600 border-stone-200";
  }
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtAbs(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

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

  const types = useMemo(() => [...new Set(initial.map((x) => x.type))].sort(), [initial]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-stone-500">
          <Filter className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Filters</span>
        </div>
        <Select label="Type" value={t} onChange={setT} options={types} />
        <Select label="Severity" value={s} onChange={setS} options={["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]} />
        <Select
          label="Status"
          value={st}
          onChange={setSt}
          options={["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"]}
        />
        <span className="ml-auto text-xs text-stone-500">
          Showing <span className="font-semibold text-stone-700">{rows.length}</span> of{" "}
          <span className="font-semibold text-stone-700">{initial.length}</span>
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gradient-to-br from-amber-50 to-orange-50 border-b border-stone-200">
              <tr>
                <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-stone-700">
                  Detected
                </th>
                <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-stone-700">
                  Type
                </th>
                <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-stone-700">
                  Severity
                </th>
                <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-stone-700">
                  Status
                </th>
                <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-stone-700">
                  Feeder
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wider font-semibold text-stone-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-stone-500">
                    No anomalies match the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const expanded = open === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className={`border-t border-stone-100 transition-colors ${
                          expanded ? "bg-amber-50/40" : "hover:bg-stone-50"
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-stone-900">{timeAgo(r.detectedAt)}</div>
                          <div className="text-[11px] text-stone-500">{fmtAbs(r.detectedAt)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-stone-900">{r.type.replace(/_/g, " ")}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${sevColor(
                              r.severity,
                            )}`}
                          >
                            {r.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusColor(
                              r.status,
                            )}`}
                          >
                            {r.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-stone-600">
                          {r.feeder ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setOpen(expanded ? null : r.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                            >
                              {expanded ? (
                                <>
                                  <ChevronDown className="size-3" /> Hide
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="size-3" /> Evidence
                                </>
                              )}
                            </button>
                            <Link
                              href={`/anomalies/${r.id}`}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-600"
                            >
                              Open <ExternalLink className="size-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-stone-50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <div>
                                <p className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1.5">
                                  Evidence (JSON)
                                </p>
                                <pre className="max-h-48 overflow-auto rounded-lg bg-stone-900 p-3 text-[11px] leading-relaxed text-stone-100">
                                  {(() => {
                                    try {
                                      return JSON.stringify(JSON.parse(r.evidence), null, 2);
                                    } catch {
                                      return r.evidence;
                                    }
                                  })()}
                                </pre>
                              </div>
                              <div>
                                <p className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1.5">
                                  Reasoning
                                </p>
                                <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm leading-relaxed text-stone-700">
                                  {r.reasoning || <em className="text-stone-400">No reasoning provided.</em>}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
      <span>{label}</span>
      <select
        className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-800 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((x) => (
          <option key={x} value={x}>
            {x.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
