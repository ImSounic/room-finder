import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { SourceHealthBar } from "@/components/SourceHealthBar";
import { StatusPicker } from "@/components/StatusPicker";
import { priceLabel, type ListingView } from "@rf/core";
import { timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

type AppRow = {
  id: string; method: string; status: string; applied_at: string;
  listings: ListingView | null;
};

export default async function AppliedPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("id,method,status,applied_at,listings(id,source,url,title,price,bills,type,furnished,area,postalcode,available_from,score,contact,status,first_seen_at)")
    .order("applied_at", { ascending: false });
  const rows = (data ?? []) as unknown as AppRow[];
  return (
    <>
      <Nav />
      <SourceHealthBar />
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-2">
        {rows.length === 0 ? (
          <div className="mx-auto mt-8 max-w-md rounded-(--radius-card) border border-dashed border-line bg-surface/50 p-8 text-center">
            <div className="mb-2 text-3xl" aria-hidden>📮</div>
            <p className="font-medium">Nothing applied yet</p>
            <p className="mt-1 text-sm text-muted">
              Hit “Mark applied” on a listing and it lands here, so you can track
              every application from sent to offer.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {rows.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-(--radius-card) border border-line bg-bg p-4 shadow-(--shadow-card)">
                <div className="min-w-0">
                  <a href={a.listings?.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-primary hover:underline">
                    {a.listings?.title ?? "(listing removed)"}
                  </a>
                  <div className="mt-0.5 text-xs text-muted">
                    {a.listings ? `${priceLabel(a.listings)} · ${a.listings.source} · ` : ""}
                    applied {timeAgo(a.applied_at)}
                    {a.method !== "manual" ? ` · ${a.method}` : ""}
                  </div>
                </div>
                <StatusPicker applicationId={a.id} initial={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
