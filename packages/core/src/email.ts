import type { ListingView } from "./present.js";
import { priceLabel } from "./present.js";

export interface Sender { name: string; phone: string; }

/** A short, polite bilingual (NL + EN) intro email to a rental agency about a listing.
 *  Pure — the dashboard supplies the sender identity from private env. */
export function draftIntroEmail(l: ListingView, me: Sender): { subject: string; body: string } {
  const street = (l.title || "the property").replace(/^\s*(studio|kamer|appartement|apartment|room|flat)\s+/i, "").trim() || l.title;
  const price = l.price !== null ? priceLabel(l) : "";
  const greetNl = l.contact?.agency ? `Beste ${l.contact.agency},` : "Geachte heer/mevrouw,";
  const greetEn = l.contact?.agency ? `Dear ${l.contact.agency},` : "Dear Sir/Madam,";
  const avail = l.available_from ? ` (beschikbaar vanaf ${l.available_from})` : "";
  const subject = `Interesse in ${street}${price ? ` — ${price}` : ""}`;
  const body = [
    greetNl,
    "",
    `Ik ben geïnteresseerd in uw woning aan ${street}${price ? ` (${price})` : ""}${avail} en zou graag een bezichtiging inplannen. Ik ben een nette huurder en per direct beschikbaar. Kunt u mij laten weten of dit mogelijk is?`,
    "",
    "Met vriendelijke groet,",
    "",
    "— — —",
    "",
    greetEn,
    "",
    `I'm interested in your property at ${street}${price ? ` (${price})` : ""} and would love to arrange a viewing. I'm a reliable tenant, available immediately. Could you let me know if that's possible?`,
    "",
    "Kind regards,",
    `${me.name}`,
    `${me.phone}`,
    l.url,
  ].join("\n");
  return { subject, body };
}
