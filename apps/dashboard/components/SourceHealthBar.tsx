import { createClient } from "@/lib/supabase/server";
import { computeSourceHealth, type SourceRunLite } from "@rf/core";
import { timeAgo } from "@/lib/time";

export async function SourceHealthBar() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("source_runs")
    .select("source,ok,total_found,new_matches,ran_at")
    .order("ran_at", { ascending: false })
    .limit(50);
  const health = computeSourceHealth((data ?? []) as SourceRunLite[]);
  if (health.length === 0) return null;
  return (
    <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs text-muted">
      <span className="font-medium">Sources</span>
      {health.map((h) => (
        <span key={h.source} className="inline-flex items-center gap-1.5" title={`last run ${new Date(h.lastRun).toLocaleString()} · ${h.totalFound} listings seen`}>
          <span aria-hidden className={`h-2 w-2 rounded-full ${h.ok ? "bg-ok" : "bg-danger"}`} />
          <span className="sr-only">{h.ok ? "healthy:" : "failing:"}</span>
          {h.source}
          <span className="text-muted/70">{timeAgo(h.lastRun)}</span>
        </span>
      ))}
    </div>
  );
}
