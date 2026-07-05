"use client";
import { useEffect, useState } from "react";
import { enablePush, disablePush, isPushEnabled } from "@/lib/push-client";

export function PushToggle() {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { isPushEnabled().then(setOn).catch(() => {}); }, []);
  async function toggle() {
    setErr(null);
    try { if (on) { await disablePush(); setOn(false); } else { await enablePush(); setOn(true); } }
    catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
  }
  return (
    <button onClick={toggle} title={err ?? ""}
      className="ml-auto rounded border px-2 py-0.5 text-xs">
      {err ? "⚠️ " : ""}{on ? "🔔 push on" : "🔕 enable push"}
    </button>
  );
}
