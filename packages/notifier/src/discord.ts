import { CRITERIA, type Listing } from "@rf/core";

interface EmbedField { name: string; inline?: boolean; value: string; }
export interface WebhookPayload {
  content?: string;
  embeds: { title: string; url: string; color: number; fields: EmbedField[] }[];
  allowed_mentions: { parse: string[] };
}

export function buildAlertPayload(l: Listing): WebhookPayload {
  const high = l.score >= CRITERIA.highPriorityScore;
  const fields: EmbedField[] = [
    { name: "Price", value: l.price != null ? `€${l.price} (${l.bills})` : "?", inline: true },
    { name: "Type", value: l.type, inline: true },
    { name: "Score", value: String(l.score), inline: true },
    { name: "Area", value: l.area ?? "?", inline: true },
    { name: "Available", value: l.availableFrom ?? "?", inline: true },
    { name: "Source", value: l.source, inline: true },
  ];
  if (l.contact) {
    const c = [l.contact.name, l.contact.agency, l.contact.email, l.contact.phone]
      .filter(Boolean).join(" · ");
    if (c) fields.push({ name: "Contact", value: c });
  }
  return {
    content: high ? `@everyone 🔥 High-priority match (${l.score})` : undefined,
    embeds: [{ title: l.title.slice(0, 250), url: l.url, color: high ? 0xe74c3c : 0x2ecc71, fields }],
    allowed_mentions: { parse: high ? ["everyone"] : [] },
  };
}

export async function sendDiscord(payload: WebhookPayload | { content: string }): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) throw new Error("DISCORD_WEBHOOK_URL not set");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 204) throw new Error(`discord webhook HTTP ${res.status}`);
}
