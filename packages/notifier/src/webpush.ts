import webpush from "web-push";
import type { Listing } from "@rf/core";

export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string }; }
export interface SendResult { endpoint: string; ok: boolean; status: number; }

export function buildPushPayload(l: Listing): string {
  const price = l.price != null ? `€${l.price}` : "€?";
  return JSON.stringify({
    title: `🏠 New match (${l.score}) — ${l.source}`,
    body: `${price} · ${l.type} · ${l.title}`,
    url: l.url,
  });
}

export function deadEndpoints(results: SendResult[]): string[] {
  return results.filter((r) => !r.ok && (r.status === 404 || r.status === 410)).map((r) => r.endpoint);
}

function configured(): boolean {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:noreply@room-finder.local", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return true;
}

export async function sendPush(subs: PushSub[], payload: string): Promise<SendResult[]> {
  if (!configured() || subs.length === 0) return [];
  return Promise.all(subs.map(async (s): Promise<SendResult> => {
    try {
      const res = await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
      return { endpoint: s.endpoint, ok: true, status: res.statusCode };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 0;
      return { endpoint: s.endpoint, ok: false, status };
    }
  }));
}
