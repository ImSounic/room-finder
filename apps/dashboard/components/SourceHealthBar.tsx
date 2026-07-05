import { createClient } from "@/lib/supabase/server";
import { computeSourceHealth, type SourceRunLite } from "@rf/core";

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
    <div className="flex flex-wrap gap-2 px-4 py-2 text-xs border-b">
      {health.map((h) => (
        <span key={h.source} className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${h.ok ? "bg-emerald-500" : "bg-red-500"}`} />
          {h.source}
          <span className="text-neutral-400">({new Date(h.lastRun).toLocaleTimeString()})</span>
        </span>
      ))}
    </div>
  );
}
