-- room-finder initial schema (applied to project bodmxdxwbqhbgxllggtz on 2026-07-05)

create table listings (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  external_id   text not null,
  url           text not null,
  title         text not null,
  price         int,
  bills         text not null default 'unknown',   -- incl | excl | unknown
  type          text not null default 'unknown',   -- studio | apartment | room-private-bath | room-shared | unknown
  furnished     text not null default 'unknown',   -- yes | semi | no | unknown
  area          text,
  postalcode    text,
  available_from date,
  score         int not null default 0,
  contact       jsonb,
  raw           jsonb,
  status        text not null default 'new',       -- new | seen | dismissed | applied
  first_seen_at timestamptz not null default now(),
  unique (source, external_id)                      -- dedup memory: ON CONFLICT DO NOTHING gate
);

create table applications (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references listings(id),
  method       text not null,                      -- auto_respond | contact_email | manual
  status       text not null default 'sent',       -- sent | replied | rejected | viewing | offer
  message      text,
  applied_at   timestamptz not null default now()
);

create table replies (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  channel        text not null,                    -- email | platform | phone | manual
  body           text,
  received_at    timestamptz not null default now()
);

create table source_runs (
  id          bigint generated always as identity primary key,
  source      text not null,
  ran_at      timestamptz not null default now(),
  ok          boolean not null,
  total_found int not null default 0,
  new_matches int not null default 0,
  error       text
);

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);

alter table listings enable row level security;
alter table applications enable row level security;
alter table replies enable row level security;
alter table source_runs enable row level security;
alter table push_subscriptions enable row level security;

create policy "authenticated full access" on listings for all to authenticated using (true) with check (true);
create policy "authenticated full access" on applications for all to authenticated using (true) with check (true);
create policy "authenticated full access" on replies for all to authenticated using (true) with check (true);
create policy "authenticated full access" on source_runs for all to authenticated using (true) with check (true);
create policy "authenticated full access" on push_subscriptions for all to authenticated using (true) with check (true);

create index listings_score_idx on listings (score desc, first_seen_at desc);
create index source_runs_source_idx on source_runs (source, ran_at desc);
