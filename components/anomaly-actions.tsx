"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AnomalyActions({ id, status }: { id: string; status: string }) {
  const r = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  async function go(next: string) {
    setMsg(null);
    const res = await fetch(`/api/anomalies/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, investigator: "demo-officer" }),
    });
    if (!res.ok) setMsg("Update failed");
    else {
      setMsg("Updated");
      r.refresh();
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status === "OPEN" ? (
        <button type="button" className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm" onClick={() => go("ACKNOWLEDGED")}>
          Acknowledge
        </button>
      ) : null}
      <button type="button" className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm" onClick={() => go("INVESTIGATING")}>
        Start investigation
      </button>
      <button type="button" className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm" onClick={() => go("RESOLVED")}>
        Resolve
        </button>
      <button type="button" className="rounded border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm" onClick={() => go("FALSE_POSITIVE")}>
        Mark false positive
      </button>
      {msg ? <span className="text-sm text-stone-600">{msg}</span> : null}
    </div>
  );
}
