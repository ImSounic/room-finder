# Room Finder — Project Plan

**Owner:** Sounic · **Goal:** Secure accommodation in Enschede with move-in **17 August 2026 or earlier**
**Written:** 2026-07-05 · **Status:** Approved design, ready for implementation

---

## 1. Problem & Goal

Rooms/studios in Enschede (especially near UT campus) are claimed within minutes of being listed. Sounic currently lives in Enschede (existing De Veste / Veste Wonen tenant, registered on the Twente student-housing portal) and needs a new place by 17 Aug 2026.

**The tool:** continuously monitor all relevant listing sources, instantly alert on matches via Discord + dashboard push, auto-apply where safely possible (else scrape the owner/agent contact details), and track everything (listings / applications / replies) in a web dashboard.

**Success criteria:**
- A new matching listing on a covered source produces a Discord alert within ~5–15 minutes of appearing.
- Zero duplicate alerts; zero missed matches on covered sources (verified by spot checks).
- Dashboard shows live listings ranked by score, with Applied / Replies tracking.
- De Veste/Roomspot responses can be fired automatically (Phase 3).
- Runs unattended on free cloud cron **and** identically on Sounic's machine.

---

## 2. Search Criteria (the "match")

### Hard filter (must pass to be stored + alerted)
| Criterion | Rule |
|---|---|
| Location | Enschede (any area) |
| Type | Studio (private kitchen + bath) **or** room with **at least private bathroom** (shared kitchen OK). Rooms with fully shared facilities are **excluded**. |
| Price | Advertised rent **€500–€950**/month (widened band to catch excl-bills edge cases; target budget is €600–900 **incl. bills**). Each listing gets a `bills` flag: `incl` / `excl` / `unknown`. |
| Availability | Available on/before 17 Aug 2026, or unspecified (many listings omit dates — don't drop them). |

### Score (ranking + alert priority, 0–100; never filters)
| Factor | Points |
|---|---|
| Studio (private kitchen + bath) | +30 (private-bath room: +15) |
| On-campus / near-campus location (keyword zones: Drienerlolaan, Calslaan, Witbreuksweg, Matenweg, Campuslaan, De Hems, Bosweg, "UT", "campus", postcode 7522; near: Hengelosestraat-north, Roombeek, 7523) | +25 on-campus / +15 near |
| Furnished | +15 (semi: +7) |
| Price | +`(950 − advertised) / 15` (cheaper = higher, max ~+30) |
| Bills included | +10 (`unknown`: +3) |

Score ≥ **70** → "high priority" alert (Discord ping with mention). Score is shown everywhere and drives dashboard sort order.

---

## 3. Sources & Per-Source Strategy

Adapter architecture: every source is one self-contained module implementing a common interface. Adding a source never touches core logic.

| # | Source | Phase | Fetch method | Apply strategy |
|---|---|---|---|---|
| 1 | ~~Roomspot.nl~~ (removed — handled manually) | — | — | User applies directly on the portal. |
| 2 | **Pararius.nl** | 1 | Plain HTTP + HTML parse (public, no login) | No on-site apply → **scrape agent name/phone/email + listing URL**, surface in alert + dashboard. Optional Phase 3: templated email via Gmail. |
| 3 | **HousingAnywhere.com** | ✅ live | HTTP (embedded router-hydration JSON) | Contact via cross-reference only (on-platform messaging not scraped). |
| 4 | **Kamernet.nl** | ✅ live | HTTP (embedded __NEXT_DATA__ JSON; Playwright fallback if blocked) | Alert-only; contact via address cross-reference to free sources (paywall never scraped). |
| 5 | **Kamer.nl** | ✅ live | Playwright (Cloudflare TLS-fingerprints plain HTTP) | Enschede-only filter; mostly whole houses over budget. |
| 6 | **Facebook groups** (Rooms/Housing Enschede groups) | 3 | Playwright with saved session cookies, **read-only**, conservative rate (every 30–60 min) | **Monitor-only — never auto-message.** Alert links straight to the post; Sounic replies personally. Protects his account. |
| 7 | **Funda.nl** (rentals) | 3 (optional) | Playwright (anti-bot) | Contact scraping. Low priority (mostly sales, few rentals in budget). |

**Universal fallback rule:** any source where auto-apply is impossible or risky → extract maximum contact info (name, agency, phone, email, direct URL) so Sounic can respond within seconds of the alert.

**Health check:** every adapter run is logged to `source_runs`. If a source yields 0 listings (not 0 *new* — 0 *total*) or errors for 3 consecutive runs → Discord warning ("adapter probably broken"). Adapters run isolated (one failing source never blocks the others).

---

## 4. Architecture

### Stack (all-TypeScript — one language everywhere = fewest integration problems)
- **Runtime:** Node 22, TypeScript, **pnpm monorepo**
- **Scraping:** `fetch` + `cheerio` for HTTP sources; **Playwright** for login/anti-bot sources
- **Database:** **Supabase** free tier (hosted Postgres + Auth + Realtime + generated TS types). Persistent state survives ephemeral cron runs; Realtime feeds the dashboard live.
- **Alerts:** **Discord webhook** to a private channel (rich embeds; `allowed_mentions` ping for high-priority). Full interactive bot (buttons) = optional later upgrade.
- **Dashboard:** **Next.js** (App Router) on **Vercel** free tier, Supabase Auth (single user), Supabase Realtime subscription, **Web Push** (service worker + VAPID) for closed-tab notifications. iOS note: requires "Add to Home Screen" PWA install.
- **Scheduling:** **GitHub Actions cron** + identical local execution (see §7).

### Monorepo layout
```
room-finder/
├── project_plan.md
├── package.json  pnpm-workspace.yaml  tsconfig.base.json
├── .github/workflows/
│   ├── scrape-fast.yml        # HTTP-only adapters, */5 min
│   └── scrape-browser.yml     # Playwright adapters, */15 min
├── packages/
│   ├── core/                  # shared types, config, Supabase client,
│   │   │                      #   SourceAdapter interface, match filter, scorer
│   │   └── src/{types,config,db,match,score}.ts
│   ├── adapters/              # one file per source + fixtures/ for tests
│   │   └── src/{roomspot,pararius,housinganywhere,kamernet,kamer,facebook}.ts
│   ├── scraper/               # worker entrypoint: run adapters → normalize →
│   │   └── src/run.ts         #   filter → upsert → alert → log source_runs
│   ├── notifier/              # discord.ts (webhook embeds), webpush.ts
│   └── autoapply/             # Phase 3: Playwright flows (roomspot respond,
│                              #   contact-email sender)
├── apps/
│   └── dashboard/             # Next.js: Listings / Applied / Replies, push
└── supabase/
    └── migrations/            # SQL schema, applied via Supabase CLI
```

### Core interface
```ts
interface SourceAdapter {
  name: string;                          // 'pararius', 'roomspot', ...
  kind: 'http' | 'browser';              // which cron lane runs it
  fetchListings(ctx: AdapterCtx): Promise<RawListing[]>;
}
interface RawListing {
  externalId: string;                    // stable per-source id (from URL/id)
  url: string;
  title: string;
  price: number | null;                  // advertised €/month
  bills: 'incl' | 'excl' | 'unknown';
  type: 'studio' | 'room-private-bath' | 'room-shared' | 'apartment' | 'unknown';
  furnished: 'yes' | 'semi' | 'no' | 'unknown';
  area: string | null;                   // street / neighbourhood / postcode
  availableFrom: string | null;          // ISO date if parseable
  contact: { name?: string; email?: string; phone?: string; agency?: string } | null;
  raw: unknown;                          // original payload for debugging
}
```
Pipeline (in `scraper/run.ts`): run adapters (parallel, isolated) → normalize → hard filter → score → `INSERT ... ON CONFLICT (source, external_id) DO NOTHING` → **alert only for rows actually inserted** (this makes dedup race-proof across overlapping cron runs) → log `source_runs` → health-check evaluation.

---

## 5. Data Model (Supabase Postgres)

```sql
create table listings (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  external_id   text not null,
  url           text not null,
  title         text not null,
  price         int,
  bills         text not null default 'unknown',   -- incl | excl | unknown
  type          text not null default 'unknown',
  furnished     text not null default 'unknown',
  area          text,
  available_from date,
  score         int not null default 0,
  contact       jsonb,
  raw           jsonb,
  status        text not null default 'new',       -- new | seen | dismissed | applied
  first_seen_at timestamptz not null default now(),
  unique (source, external_id)                      -- the dedup memory
);

create table applications (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references listings(id),
  method       text not null,        -- auto_respond | contact_email | manual
  status       text not null default 'sent',  -- sent | replied | rejected | viewing | offer
  message      text,
  applied_at   timestamptz not null default now()
);

create table replies (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  channel        text not null,      -- email | platform | phone | manual
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
```
Row Level Security ON; single authenticated user (Sounic) has full access; the worker uses the service-role key.

---

## 6. Notifications

**Discord (primary, instant):** webhook → private channel. Embed per new match: title, €price (+ bills flag), type, furnished, area, **score**, direct link, contact details if scraped, source name. Score ≥ 70 → content includes a mention ping. Health warnings and daily summary (one message: found/new/applied counts) go to the same channel.

**Dashboard push:** worker calls a small Next.js API route (or Supabase Edge Function) that sends Web Push to all `push_subscriptions`. Open-tab updates arrive via Supabase Realtime without push.

---

## 7. Runtime & Deployment

**Two-lane cron (fixes the free-minutes problem):**
- `scrape-fast.yml` — `*/5 * * * *` (UTC), HTTP-only adapters (`kind: 'http'`), no browser install, ~20–40 s/run.
- `scrape-browser.yml` — `*/15 * * * *`, Playwright adapters, Playwright browser cached, ~2–3 min/run.

**Minutes budget:** private repos get 2,000 free min/month — the browser lane alone (~96 runs/day × 2.5 min ≈ 7,200 min/mo) blows past it. **Decision: public GitHub repo** (public repos = unlimited free Actions minutes). All secrets live exclusively in GitHub Secrets / `.env` (git-ignored); no credentials, cookies, or personal data ever committed. Fallback if public repo becomes uncomfortable: free-tier VM (Oracle/Fly.io) running the same worker on a systemd timer.

**Local mode (option B):** `pnpm scrape` (optionally `--loop 300`) runs the identical worker from Sounic's machine — useful while at the PC and as backup when Actions queues are slow (GH cron can lag 5–15 min at peak; accepted trade-off of the free tier, mitigated by the local loop).

**Dashboard:** Vercel free tier, env vars for Supabase URL/anon key + VAPID keys.

**Secrets inventory:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_WEBHOOK_URL`, `ROOMSPOT_USER`, `ROOMSPOT_PASS`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, later: `KAMERNET_*`, `FB_SESSION_COOKIES`, `GMAIL_*`.

---

## 8. Dashboard Spec (apps/dashboard)

- **Listings tab (default):** live-updating table/cards sorted by score desc, then newest. Filters: source, min score, status, type. Row actions: *Open listing*, *Mark applied* (creates `applications` row), *Dismiss*. Contact details shown inline when scraped.
- **Applied tab:** applications with status pipeline (`sent → replied → viewing → offer/rejected`), editable status, notes field, linked listing.
- **Replies tab:** replies linked to applications; Phase 1–2 = manual entry; Phase 3 = optional Gmail/IMAP ingestion for agent email replies.
- **Header:** per-source health (last run, last success, total found) from `source_runs`; push-notification enable button.
- Auth: Supabase email/password login (single user). Mobile-friendly (this will mostly be used from a phone reacting to alerts).

---

## 9. Auto-Apply (Phase 3 detail)

1. **Roomspot auto-respond:** Playwright logs in with Sounic's real credentials, opens each new matching listing, clicks respond/react, records an `applications` row (`method='auto_respond'`), and Discord-confirms. Guardrails: max responses/day cap, dry-run mode first, screenshot on every step stored for audit, instant Discord alert on flow failure (layout changed).
2. **Contact-email sender (Pararius/agents):** templated Dutch/English intro email (Sounic-approved template with per-listing substitutions) sent via Gmail API from his account, only when `contact.email` was scraped. Per-agency dedup so the same agency isn't spammed twice in a day. Manual-approve mode first (Discord message with the draft → Sounic clicks approve in dashboard), full-auto only if he later opts in.
3. **Never automated:** Kamernet messaging, Facebook messaging (account-ban risk, stated explicitly as out of scope).

---

## 10. Testing Strategy

- **Adapters:** each parses saved HTML/JSON **fixtures** offline (`fixtures/` dir) — unit tests assert extraction of price/type/area/contact. Fixtures refreshed when a site changes; live smoke test script per adapter (`pnpm smoke pararius`) for manual verification.
- **Core:** unit tests for hard filter (boundary prices 499/500/950/951, type mapping, date parsing) and scorer (campus keywords, bills flags).
- **Pipeline:** integration test against a local/branch Supabase with a fake adapter — asserts dedup (second run inserts 0, alerts 0) and race-proof alerting.
- **Auto-apply:** dry-run mode mandatory in CI; real runs only from Sounic's machine initially.
- CI: lint + typecheck + tests on every push (same public repo).

---

## 11. Implementation Phases & Task Breakdown

### Phase 1 — MVP: monitor + alert (target: days 1–4)
1. Scaffold pnpm monorepo, tsconfig, lint, CI skeleton.
2. Supabase project + migrations (§5 schema) + generated types.
3. `core`: types, config (criteria as data, not code), match filter, scorer + unit tests.
4. `adapters/pararius` (HTTP+cheerio) with fixtures + tests.
5. `adapters/roomspot` (Playwright login) — **first step: verify live domain/flow/selectors**; fixtures + tests.
6. `scraper/run.ts` pipeline + `source_runs` logging + health-check.
7. `notifier/discord.ts` embeds + ping threshold + daily summary.
8. GitHub Actions two-lane crons + secrets + local `pnpm scrape --loop`.
9. **Milestone:** real Discord alerts flowing from both sources, deduped, ranked.

### Phase 2 — Dashboard + more sources (days 5–10)
10. Next.js dashboard: auth, Listings tab with Realtime, deploy to Vercel.
11. Applied/Replies tabs + status actions + manual entry.
12. Web Push (service worker, VAPID, subscription storage, worker → push route).
13. Health header UI.
14. `adapters/housinganywhere`, `adapters/kamernet`, `adapters/kamer` (+fixtures/tests, added to appropriate cron lane).
15. **Milestone:** phone-installable dashboard with push; 5 sources live.

### Phase 3 — Auto-apply + long tail (days 11–16)
16. `autoapply/roomspot` respond flow (dry-run → capped live) + application recording.
17. Contact-email sender with manual-approve loop (Gmail API).
18. `adapters/facebook` monitor-only (session cookies, 30–60 min cadence).
19. Optional: Gmail reply ingestion into Replies; optional Funda adapter.
20. **Milestone:** matches on Roomspot get responses automatically; everything else is one-tap.

Each phase ends with a working, deployed increment — if time runs short, earlier phases already deliver the core value (instant alerts).

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Site layout changes silently break an adapter | `source_runs` health-check → Discord warning after 3 empty/failed runs; fixture-based tests localize the fix |
| GH Actions cron lag at peak times | Accepted (free); local `--loop` mode as supplement; browser lane at 15 min keeps queue pressure low |
| Kamernet/Facebook anti-bot blocks | Alert-only posture, conservative rates, Playwright stealth; these sources are best-effort by design |
| Account bans from automation | Auto-actions only on Roomspot (legitimate tenant) and own Gmail; FB/Kamernet never auto-message |
| Public repo exposure | No secrets/PII in code, secrets only in GH Secrets/.env, criteria config contains no credentials |
| Supabase free-tier pause after inactivity | Cron writes every 5 min keep it active |
| Price/type parsing ambiguity drops good listings | Widened price band + `unknown`-tolerant filter + everything visible in dashboard for spot-checking |

---

## 13. Out of Scope (explicit)

- Auto-messaging on Facebook or Kamernet
- Multi-user support, payments, mobile-native app
- Sources outside the list in §3; cities other than Enschede
