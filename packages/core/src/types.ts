export type Bills = "incl" | "excl" | "unknown";
export type UnitType = "studio" | "apartment" | "room-private-bath" | "room-shared" | "unknown";
export type Furnished = "yes" | "semi" | "no" | "unknown";

export interface Contact {
  name?: string;
  email?: string;
  phone?: string;
  agency?: string;
}

export interface RawListing {
  externalId: string;
  url: string;
  title: string;
  price: number | null;
  bills: Bills;
  type: UnitType;
  furnished: Furnished;
  area: string | null;
  postalcode: string | null;
  availableFrom: string | null; // ISO yyyy-mm-dd
  contact: Contact | null;
  raw: unknown;
  // clean "Street 12a" when the source provides it — preferred basis for the cross-source address key
  streetAddress?: string | null;
}

export interface Listing extends RawListing {
  source: string;
  score: number;
  isMatch: boolean;
  addressKey?: string | null;
}

export interface AdapterCtx {
  fetch: typeof fetch;
}

export interface SourceAdapter {
  name: string;
  kind: "http" | "browser";
  venue: "cloud" | "local";
  fetchListings(ctx: AdapterCtx): Promise<RawListing[]>;
  /** Optional: enrich listings (e.g. fetch detail pages for contact info)
   *  before they're inserted. Called once per listing — only for listings
   *  new to the DB (first sighting), regardless of match — since contact
   *  info doesn't change, so it's never re-fetched on later runs. */
  enrichListings?(listings: Listing[]): Promise<Listing[]>;
}
