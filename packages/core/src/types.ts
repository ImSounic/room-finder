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
}

export interface Listing extends RawListing {
  source: string;
  score: number;
}

export interface AdapterCtx {
  fetch: typeof fetch;
}

export interface SourceAdapter {
  name: string;
  kind: "http" | "browser";
  fetchListings(ctx: AdapterCtx): Promise<RawListing[]>;
}
