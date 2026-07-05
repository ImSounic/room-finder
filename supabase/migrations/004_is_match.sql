alter table listings add column if not exists is_match boolean not null default false;
create index if not exists listings_is_match_idx on listings (is_match) where is_match;
-- backfill: rows existing before this migration all passed the old hard filter
update listings set is_match = true;
