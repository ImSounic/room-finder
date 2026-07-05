import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { SourceHealthBar } from "@/components/SourceHealthBar";
import { AddReply } from "@/components/AddReply";
import { timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

type ReplyRow = { id: string; channel: string; body: string | null; received_at: string;
  applications: { id: string; listings: { title: string } | null } | null };

export default async function RepliesPage() {
  const supabase = await createClient();
  const [{ data: replies }, { data: apps }] = await Promise.all([
    supabase.from("replies").select("id,channel,body,received_at,applications(id,listings(title))").order("received_at", { ascending: false }),
    supabase.from("applications").select("id,listings(title)").order("applied_at", { ascending: false }),
  ]);
  const rows = (replies ?? []) as unknown as ReplyRow[];
  const appOpts = ((apps ?? []) as unknown as { id: string; listings: { title: string } | null }[])
    .map((a) => ({ id: a.id, title: a.listings?.title ?? a.id }));
  return (
    <>
      <Nav />
      <SourceHealthBar />
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-2">
        <AddReply applications={appOpts} />
        {rows.length === 0 ? (
          <div className="mx-auto mt-8 max-w-md rounded-(--radius-card) border border-dashed border-line bg-surface/50 p-8 text-center">
            <div className="mb-2 text-3xl" aria-hidden>💬</div>
            <p className="font-medium">No replies logged</p>
            <p className="mt-1 text-sm text-muted">
              {appOpts.length === 0
                ? "Once you've applied to a listing, log landlord replies here to keep the whole conversation in one place."
                : "When a landlord answers, log it above — future you will thank present you."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {rows.map((r) => (
              <div key={r.id} className="rounded-(--radius-card) border border-line bg-bg p-4 shadow-(--shadow-card)">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                  <span className="font-semibold text-ink">{r.applications?.listings?.title ?? "?"}</span>
                  <span className="rounded-md bg-surface px-1.5 py-0.5 font-medium">{r.channel}</span>
                  <span>{timeAgo(r.received_at)}</span>
                </div>
                {r.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.body}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
