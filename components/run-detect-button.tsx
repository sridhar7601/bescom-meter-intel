"use client";

import { useState } from "react";

export function RunDetectButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setMsg(null);
          const r = await fetch("/api/detect/run", { method: "POST" });
          const j = (await r.json()) as { newAnomalies?: number };
          setMsg(`Run complete. New anomalies: ${j.newAnomalies ?? 0}. Refresh page.`);
          setLoading(false);
        }}
        className="rounded-md border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-50"
      >
        {loading ? "Running…" : "Run anomaly detection"}
      </button>
      {msg ? <p className="mt-2 text-sm text-stone-600">{msg}</p> : null}
    </div>
  );
}
