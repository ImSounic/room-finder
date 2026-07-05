import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { SourceHealthBar } from "@/components/SourceHealthBar";
import { StatusPicker } from "@/components/StatusPicker";
import { priceLabel, type ListingView } from "@rf/core";

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
      <div className="p-4 flex flex-col gap-2">
        {rows.length === 0 && <p className="text-neutral-500 text-sm">No applications yet.</p>}
        {rows.map((a) => (
          <div key={a.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
            <div>
              <a href={a.listings?.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                {a.listings?.title ?? "(listing removed)"}
              </a>
              <div className="text-xs text-neutral-500">
                {a.listings ? `${priceLabel(a.listings)} · ${a.listings.source}` : ""} · {a.method} · {new Date(a.applied_at).toLocaleDateString()}
              </div>
            </div>
            <StatusPicker applicationId={a.id} initial={a.status} />
          </div>
        ))}
      </div>
    </>
  );
}
