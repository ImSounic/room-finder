const PAYWALLED = new Set(["kamernet"]);

/** Stable key from postcode + street + house number(s). null if no house number to anchor on. */
export function addressKey(street: string | null, postalcode: string | null): string | null {
  if (!street) return null;
  const nums = street.match(/\d+/g);
  if (!nums) return null;
  const streetName = street.toLowerCase().replace(/\d+/g, " ").replace(/[^a-z]+/g, " ").trim().replace(/\s+/g, "-");
  const pc = (postalcode ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${pc}-${streetName}-${nums.join("-")}`;
}

export interface CrossRow {
  id: string; source: string; address_key: string | null; url: string;
  contact: { name?: string; email?: string; phone?: string; agency?: string } | null;
}

/** For a listing, find another source at the same address that has usable contact info.
 *  Prefers a non-paywalled twin (reach the landlord for free). Returns null if none. */
export function linkByAddress<T extends CrossRow>(row: T, all: T[]): T | null {
  if (!row.address_key) return null;
  const twins = all.filter((r) => r.id !== row.id && r.address_key === row.address_key);
  const withContact = twins.filter((r) => r.contact && (r.contact.phone || r.contact.email || r.contact.agency));
  if (withContact.length === 0) return null;
  return withContact.find((r) => !PAYWALLED.has(r.source)) ?? withContact[0];
}
