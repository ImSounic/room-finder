import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { SourceHealthBar } from "@/components/SourceHealthBar";
import { AddReply } from "@/components/AddReply";

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
      <div className="p-4">
        <AddReply applications={appOpts} />
        <div className="flex flex-col gap-2">
          {rows.length === 0 && <p className="text-neutral-500 text-sm">No replies logged.</p>}
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border p-3 text-sm">
              <div className="text-xs text-neutral-500">
                {r.applications?.listings?.title ?? "?"} · {r.channel} · {new Date(r.received_at).toLocaleString()}
              </div>
              {r.body && <div className="mt-1 whitespace-pre-wrap">{r.body}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
