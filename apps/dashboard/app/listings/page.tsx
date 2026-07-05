import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { SourceHealthBar } from "@/components/SourceHealthBar";
import { ListingsLive } from "@/components/ListingsLive";
import type { ListingView } from "@rf/core";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("id,source,url,title,price,bills,type,furnished,area,postalcode,available_from,score,contact,status,first_seen_at,address_key")
    .order("score", { ascending: false })
    .limit(200);
  return (
    <>
      <Nav />
      <SourceHealthBar />
      <ListingsLive initial={(data ?? []) as ListingView[]} />
    </>
  );
}
