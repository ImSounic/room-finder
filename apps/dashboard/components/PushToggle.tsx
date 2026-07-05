"use client";
import { useEffect, useState } from "react";
import { enablePush, disablePush, isPushEnabled } from "@/lib/push-client";

export function PushToggle() {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Best-effort initial state; failures just leave the toggle off (nothing actionable).
  useEffect(() => { isPushEnabled().then(setOn).catch(() => {}); }, []);
  async function toggle() {
    setErr(null);
    try { if (on) { await disablePush(); setOn(false); } else { await enablePush(); setOn(true); } }
    catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
  }
  return (
    <button
      onClick={toggle}
      title={err ?? (on ? "Push notifications are on" : "Get pinged when a new match lands")}
      aria-pressed={on}
      className={`ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150 ${
        on
          ? "border-transparent bg-primary-soft text-primary"
          : "border-line text-muted hover:bg-surface hover:text-ink"
      }`}
    >
      <span aria-hidden>{err ? "⚠️" : on ? "🔔" : "🔕"}</span>
      <span className="hidden sm:inline">{on ? "Push on" : "Enable push"}</span>
    </button>
  );
}
