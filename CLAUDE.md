# CLAUDE.md

Decisions already made for this project. Don't relitigate these — if one looks
wrong, raise it rather than quietly switching.

## The hard rules

Everything else in this file is a decision you can question. These two are
not — they need an explicit yes from the owner, every time.

### 1. Data model changes need clearance

**Get sign-off before any DDL is run or the storage structure changes.** That
covers creating, altering, or dropping tables, columns, constraints, indexes,
and generated columns; and changing bucket names or the key layout inside a
bucket. Authorisation is no longer schema — it lives in `server/api/` — but the
same gate applies to changing who a route lets through.

**Propose in SQL.** The owner reads DDL fine and prefers it to prose — show the
statements, add a line only where intent isn't obvious from them. Don't pad it
into an essay. What needs a yes is *executing* it, or shipping code that writes
to a new storage layout.

The gate is largely self-enforcing: the sandbox refuses writes to remote
resources, so schema changes get run by the owner with `wrangler` either way.

Schema outlives everything else here and is expensive to unpick once real trip
data exists.

### 2. Never push to `main` without consent

Committing freely is fine. **Pushing is not** — `git push` publishes to a
public GitHub repo, so it is the step that makes work visible to the world.
Wait to be asked. Deploying is separate — `wrangler deploy` publishes to the
live site and needs its own yes.

"Push it" authorises that push, not the next one. If a push seems necessary to
unblock something (a hosted build needs a file, say), ask rather than assume.

### Both rules share a failure mode

The owner delegates framework, styling, and infra choices readily and answers
fast. A quick "sure, if you think that's best" on an adjacent question is
**not** clearance for either of these. Ask specifically, every time.

## What this is

An app for recording kayak trips: routes, durations, campsites, photos.
Public read, a handful of logged-in editors. Personal scale — free tiers are
expected to cover it.

## Stack decisions

- **Nuxt 4 (Vue), not Next.js.** The owner knows Vue better. This was an
  explicit choice after considering both.
- **Cloudflare for everything** since 2026-09-13: Workers (hosting and server
  routes), D1 (database), R2 (photos), Access (auth). Migrated off
  Vercel + Supabase because the Supabase free tier caps at 1 GB of storage and
  5 GB of egress and pauses after 7 days idle; the 30 existing photos were
  already 86 MB. R2 gives 10 GB with egress free and nothing pauses.
- **PWA, not native.** Installable via the browser, no app store, no
  React Native. Revisit only if offline maps or background GPS become real
  requirements.
- **MapLibre + OpenStreetMap** — free outright, so no reason to spend Mapbox's
  free tier on a personal project. Now in use on the trip page:
  - Raster tiles straight from `tile.openstreetmap.org`, no key and no account.
    Attribution is a licence condition and MapLibre renders it from the source
    definition — don't remove it.
  - `TripMap.vue` imports MapLibre dynamically inside `onMounted`, so the
    ~500 KB never reaches the server bundle or a page without a map. It needs
    WebGL2 and throws outright without it, so construction is wrapped and falls
    back to listing the coordinates as text.
  - The map is also the coordinate *input* — click to place. There is no other
    way to set a trip's put-in/take-out, since trips have no edit form.

## Cloudflare workflow

One Cloudflare account, talked to directly from local dev. Resources:

| | |
| --- | --- |
| Worker | `kayaktrips` → `https://kayaktrips.vixim.workers.dev` |
| D1 | `kayaktrips`, id `5fd4f60f-c024-49b4-8cf8-20950fde060f`, region OC |
| R2 | `kayaktrips-photos`, region OC, **private** |
| Access | team `vixim.cloudflareaccess.com`, app "Kayak Trips — editing" |

Bindings live in `wrangler.jsonc`: `DB`, `PHOTOS`, `ASSETS`. Deploy with
`npx wrangler deploy` after `npm run build`.

**No migration files yet**, same as before — that ceremony isn't worth it until
there's real user data. When it is, D1 has `wrangler d1 migrations`.

⚠️ **The schema lives in `db/schema.sql` and in D1, and nothing detects drift.**
The file is hand-maintained — if you change the schema, update it in the same
commit and re-run it.

Storage: R2 objects are keyed `<photo-id>.<ext>`, flat, no folders. The bucket
is private; `server/routes/img/[key].get.ts` serves the bytes with an immutable
cache header. There is no public bucket URL and no custom domain.

`scripts/export-from-supabase.mjs` produced the one-off migration and is kept
for reference. Its outputs (`db/seed.sql`, `db/photos/`, `db/users.local.json`)
are gitignored because they carry real email addresses and this repo is public.

## Data model

### `photos`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | PK — a uuid generated in app code |
| `storage_path` | `text` | not null, **unique** — R2 key, `<photo-id>.<ext>` |
| `uploaded_by` | `text` | the Access email, nullable. No FK — accounts live in Access, not the database |
| `caption` | `text` | nullable |
| `trip_id` | `text` | FK → `trips`, `on delete set null`, nullable |
| `created_at` | `text` | not null, ISO 8601 UTC |

Design intent worth preserving:

- **Paths, never URLs.** URLs are derived at render time, so the bucket or
  project can move without rewriting rows.
- **`on delete set null`**, not cascade — a photo is a record of a trip and
  outlives the account that posted it. Attribution is lost, the photo isn't.
- **No RLS — SQLite has none.** Every policy that used to live in the database
  now lives in `server/api/`. `requireEditor()` in `server/utils/access.ts` is
  the boundary: it verifies the Cloudflare Access token and is what stops one
  person posting as another, since `uploaded_by` comes from the verified token
  and is never accepted from the request.
- **The client never names a storage key.** The upload route generates it from
  a fresh id and the validated MIME type. This is deliberate: the old storage
  policy checked the path's first segment against the uploader, and nothing
  replaces that check except not trusting the client at all.
- **Deleting removes the row first, then the object**
  (`server/api/photos/[id].delete.ts`). The other order can leave a row
  pointing at a missing file — a broken tile; this order can only leave an
  orphaned object, which nothing lists. The client sends an id, never a path,
  so only a row can name a file for deletion.
- **`trip_id` is nullable and means "not filed under a trip".** Rows that
  predate trips stay NULL. There is still no update route for photos, so filing
  happens at upload time only — the picker on `/upload` sets it on insert.

Orphans are no longer possible: the upload route deletes the object it just
wrote if the row insert fails. Under Supabase the two sides were different
services and it couldn't.

### `trips`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | PK — a uuid generated in app code |
| `slug` | `text` | not null, **unique** — derived from the title, addresses `/trips/<slug>` and the API |
| `title` | `text` | not null |
| `start_date` | `text` | not null, `'YYYY-MM-DD'` |
| `end_date` | `text` | not null, `check (end_date >= start_date)` — ISO text sorts lexically |
| `start_place` | `text` | nullable — put-in, e.g. "Lock 9" |
| `end_place` | `text` | nullable — take-out |
| `start_lat` / `start_lon` | `real` | nullable |
| `end_lat` / `end_lon` | `real` | nullable |
| `notes` | `text` | nullable |
| `badge_photo_id` | `text` | FK → `photos`, `on delete set null` |
| `created_by` | `text` | the Access email, nullable. No FK |
| `created_at` | `text` | not null, ISO 8601 UTC |

Design intent worth preserving:

- **Dates, not a duration.** Length is derived (`tripDayCount` in
  `app/utils/trips.ts`, inclusive of both ends), so campsite dates can later be
  range-checked against the trip instead of against arithmetic.
- **Plain `real` lat/lon.** A handful of points per trip and MapLibre wants
  lng/lat pairs anyway.
- **Trips are addressed by slug in the API, not by id.** Nitro registers one
  parameter name per path segment, so `[slug].get.ts` and a sibling calling it
  `id` silently read back undefined. The slug never changes, so it is also the
  more coherent identifier.
- **`trips` and `photos` reference each other**, which is why the migration
  inserts trips with a null badge and backfills it. There is no PostgREST any
  more, so the embed that had to name the constraint is now a `left join`.
- **`badge_photo_id` and `PATCH /api/trips/<slug>`**: the route allowlists the
  fields it will write, so a request cannot reach `slug` or `created_by`.
- Nothing constrains the badge to a photo *of* that trip; only the UI does.
  A composite FK or trigger would enforce it, and isn't worth it yet.

### `campsites`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | PK — a uuid generated in app code |
| `trip_id` | `text` | not null, FK → `trips`, **`on delete cascade`** |
| `name` | `text` | not null |
| `camped_on` | `text` | not null, `'YYYY-MM-DD'` — the night camped |
| `notes` | `text` | nullable |
| `lat` / `lon` | `real` | nullable |
| `bankage`, `campspots`, `firewood`, `shelter`, `aesthetics` | `real` | nullable, `check (… in (0, 0.5, 1, 1.5, 2))` |
| `score` | `real` | generated, stored — the sum of the five |
| `created_by` | `text` | the Access email, nullable. No FK |
| `created_at` | `text` | not null, ISO 8601 UTC |

Design intent worth preserving:

- **`on delete cascade`, unlike `photos.trip_id`.** A campsite has no meaning
  apart from its trip; a photo is a record in its own right and survives.
- **Ratings as five columns with an `IN` list**, not half-point integers and
  not JSON. The check enforces range and half-step at once and reads as the
  rule it is. ⚠️ A sixth category is **not** a simple `add column` any more:
  SQLite cannot `ALTER TABLE ADD` a *stored* generated column, so `score` has
  to be rebuilt by copying the table.
- **Ratings are nullable and `score` is a plain sum**, so any missing component
  makes `score` NULL. An unrated site sorts as unrated rather than as zero.
- **Nothing constrains `camped_on` to the trip's dates** — a `CHECK` can't
  reach another table. `TripCampsites.vue` warns but still saves, because
  camping the night before the official put-in genuinely happens.
- **`camped_on`, not `date`** — `date` is a type name and needs quoting in too
  many places.
- No `unique (trip_id, camped_on)`: it would block recording both the site you
  bailed on at dusk and the one you slept at.

## Environment

- **Node 22** (`.nvmrc`). Several transitive deps require it; Node 20 produces
  engine warnings.
- **`legacy-peer-deps=true` in `.npmrc` is load-bearing.** Without it npm 10's
  arborist crashes with `Cannot read properties of null (reading 'edgesOut')`
  on Nuxt 4's peer graph. Don't "tidy" it away.
- Secrets live in `.env` (gitignored). `.env.example` documents the shape. The
  Cloudflare API token is the only real secret; the Access team domain and AUD
  are public identifiers and live in `wrangler.jsonc`.
- **The token expires.** A lapsed one fails deploys with a 403 and the cause
  isn't obvious from the error.

## Auth

- **Cloudflare Access, One-time PIN, no identity provider.** The allowlist is a
  list of emails in the Access policy — dashboard config, not code. There is no
  users table, no password handling, and no sign-up page. Team domain is
  `vixim.cloudflareaccess.com`; sessions last a month.
- Not Supabase Auth any more, and not magic links: the old constraint was
  Supabase's 2-messages-per-hour default mailer. Access sends its own codes.
- **Signing in is a navigation, not a page.** `AccountControl.vue` links to
  `/upload` with a plain `<a>`; Access challenges at the edge and returns you
  there. A client-side route change never reaches the edge, so `NuxtLink` would
  silently not log you in. Sign-out is Access's `/cdn-cgi/access/logout`.
- **Two layers, and they are not interchangeable.** Access covers the two
  editor *pages* (`/upload`, `/trips/new`). Every write route separately
  verifies the token via `requireEditor()`. Both are needed:
  - Access matches on **path and cannot see the method**. `/api/trips` serves
    public GETs and editor POSTs on one path, so gating it would take the
    public site down. Never put Access in front of `/api/`.
  - Inline editing on `/trips/<slug>` happens on a **public** page, where
    Access never runs. Only the route check protects it.
  When adding an editable page, add it to the Access application's destinations
  *and* make sure its routes call `requireEditor()`.
- **An unconfigured deployment refuses writes.** Missing `NUXT_ACCESS_AUD` or
  team domain means `editorEmail()` returns null rather than trusting anyone.
- `useEditor()` asks `/api/me` and is **client-only on purpose** — rendering
  editor controls server-side would let a cache serve editor HTML to an
  anonymous visitor. The controls appearing a beat after load is that, not a bug.

## Free-tier limits worth knowing

- Workers: **100k requests/day**, 10 ms CPU each. Static assets don't count.
- D1: **5 GB**, 5M row reads and 100k row writes/day.
- R2: **10 GB**, egress free. Currently 86 MB across 30 photos.
- Access: **50 users**.
- **Nothing pauses.** That was the point of leaving Supabase.
- Upload size and type are enforced in `server/api/photos/index.post.ts`
  (10 MB, MIME allowlist) — a real boundary now, not the UX guard the
  client-side check in `app/pages/upload.vue` was.
- ⚠️ 30 photos are already 86 MB. Downscaling on upload is the obvious win and
  hasn't been done.

## Scope discipline

Trips, campsites, photos, maps and auth are all built and working. This is
still a personal project at personal scale — don't build ahead of what's asked.

## Conventions

- No component library or CSS framework so far — plain scoped CSS in each
  page, dark palette (`#0f172a` background, `#38bdf8` accent).
- Pages live in `app/pages/`.
