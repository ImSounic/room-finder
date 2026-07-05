-- Phase 2b: cross-source address matching (applied to bodmxdxwbqhbgxllggtz on 2026-07-05)
-- Normalized address key lets a paywalled listing surface a free contact from the
-- same property on another source. Stamped on insert by the pipeline (addressKey()).

alter table listings add column if not exists address_key text;
create index if not exists listings_address_key_idx on listings (address_key);
