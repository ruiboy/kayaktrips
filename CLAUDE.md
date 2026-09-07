# CLAUDE.md

Decisions already made for this project. Don't relitigate these — if one looks
wrong, raise it rather than quietly switching.

## The hard rules

Everything else in this file is a decision you can question. These two are
not — they need an explicit yes from the owner, every time.

### 1. Data model changes need clearance

**Get sign-off before any DDL is run or the storage structure changes.** That
covers creating, altering, or dropping tables, columns, constraints, indexes,
and RLS policies; and changing bucket names or the path/folder layout inside a
bucket.

**Propose in SQL.** The owner reads DDL fine and prefers it to prose — show the
statements, add a line only where intent isn't obvious from them. Don't pad it
into an essay. What needs a yes is *executing* it, or shipping code that writes
to a new storage layout.

The gate is largely self-enforcing: no DDL credentials are configured here, so
schema changes get run by the owner in the SQL Editor either way.

Schema outlives everything else here and is expensive to unpick once real trip
data exists.

### 2. Never push to `main` without consent

Committing freely is fine. **Pushing is not** — `git push` publishes to a
public GitHub repo and triggers a Vercel deploy to the live site, so it is the
step that makes work visible to the world. Wait to be asked.

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
- **Supabase** for Postgres, Storage, and Auth. Relational data (trips →
  campsites → photos) makes Postgres a better fit than Firestore.
- **Vercel** for hosting.
- **PWA, not native.** Installable via the browser, no app store, no
  React Native. Revisit only if offline maps or background GPS become real
  requirements.
- **MapLibre + OpenStreetMap** when maps arrive — free outright, so no reason
  to spend Mapbox's free tier on a personal project.

## Supabase workflow

One cloud Supabase project, talked to directly from local dev. **No local
Supabase, no Docker, no migration files** at this stage — that ceremony isn't
worth it until there's real user data. When it is, the step is: adopt the
Supabase CLI for migrations and add a second project for staging.

⚠️ **The schema now lives only in the database.** There are no migration files,
so the repo has no record of it and nothing detects drift. The section below is
hand-maintained — if you change the schema, update it in the same commit. The
CLI is the real fix; the owner has parked it deliberately, not forgotten it.

Storage: a public bucket named `photos`, public read, uploads restricted to
authenticated users. Files live at `<uploader-user-id>/<epoch-ms>-<uuid>.<ext>`.

## Data model

### `public.photos`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `storage_path` | `text` | not null, **unique** — path within the `photos` bucket |
| `uploaded_by` | `uuid` | FK → `auth.users`, `on delete set null` |
| `caption` | `text` | nullable |
| `trip_id` | `uuid` | FK → `public.trips`, `on delete set null`, nullable |
| `created_at` | `timestamptz` | not null, `now()` |

Design intent worth preserving:

- **Paths, never URLs.** URLs are derived at render time, so the bucket or
  project can move without rewriting rows.
- **`on delete set null`**, not cascade — a photo is a record of a trip and
  outlives the account that posted it. Attribution is lost, the photo isn't.
- **RLS**: public `select` for `anon` and `authenticated`; `insert` restricted
  to `authenticated` with `uploaded_by = auth.uid()`, so nobody can post as
  someone else; `delete` for `authenticated` with no ownership check, matching
  the update policy on `trips` — a handful of trusted editors, and a photo
  whose uploader was deleted has `uploaded_by` NULL and would otherwise be
  undeletable. There is still no `update` policy, which is why filing is
  upload-time only.
- **Deleting removes the row first, then the storage object**
  (`app/pages/trips/[slug].vue`). The other order can leave a row pointing at a
  missing file — a broken tile; this order can only leave an orphaned file,
  which nothing lists. Deleting also needs a matching `delete` policy on
  `storage.objects` for `bucket_id = 'photos'`.
- **`trip_id` is nullable and means "not filed under a trip".** Rows that
  predate trips stay NULL. Because `photos` has no `update` policy, filing
  happens at upload time only — the picker on `/upload` sets it on insert.

Orphans are possible by design: the file uploads before the row is inserted, so
a failed insert leaves an unreferenced file. Harmless — nothing lists the
bucket — but it means bucket contents and table rows can disagree.

### `public.trips`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `slug` | `text` | not null, **unique** — derived from the title, addresses `/trips/<slug>` |
| `title` | `text` | not null |
| `start_date` | `date` | not null |
| `end_date` | `date` | not null, `check (end_date >= start_date)` |
| `start_place` | `text` | nullable — put-in, e.g. "Lock 9" |
| `end_place` | `text` | nullable — take-out |
| `start_lat` / `start_lon` | `double precision` | nullable |
| `end_lat` / `end_lon` | `double precision` | nullable |
| `notes` | `text` | nullable |
| `badge_photo_id` | `uuid` | FK → `public.photos`, constraint `trips_badge_photo_fkey`, `on delete set null` |
| `created_by` | `uuid` | FK → `auth.users`, `on delete set null` |
| `created_at` | `timestamptz` | not null, `now()` |

Design intent worth preserving:

- **Dates, not a duration.** Length is derived (`tripDayCount` in
  `app/utils/trips.ts`, inclusive of both ends), so campsite dates can later be
  range-checked against the trip instead of against arithmetic.
- **Plain `double precision` lat/lon, not PostGIS.** A handful of points per
  trip and MapLibre wants lng/lat pairs anyway. The columns are nullable and
  unused by the UI so far — they exist so the map doesn't cost a second round
  of DDL on a table that by then holds real trips.
- **RLS**: public `select`; `insert` for `authenticated` with
  `created_by = auth.uid()`; `update` for `authenticated`, which is what setting
  the badge uses. Nothing edits a trip's own fields yet.
- **The badge FK is named explicitly.** `photos` sits on both ends of a
  relationship with `trips` now — `photos.trip_id` one way, `badge_photo_id`
  the other — so PostgREST can't infer which is meant and embeds must name the
  constraint: `badge:photos!trips_badge_photo_fkey(storage_path)`.
- Nothing constrains the badge to a photo *of* that trip; only the UI does.
  A composite FK or trigger would enforce it, and isn't worth it yet.
- Still to come: a `campsites` table.

## Environment

- **Node 22** (`.nvmrc`). Several transitive deps require it; Node 20 produces
  engine warnings.
- **`legacy-peer-deps=true` in `.npmrc` is load-bearing.** Without it npm 10's
  arborist crashes with `Cannot read properties of null (reading 'edgesOut')`
  on Nuxt 4's peer graph — locally and in Vercel's build. Don't "tidy" it away.
- Secrets live in `.env` (gitignored). `.env.example` documents the shape.

## Auth

- **Email + password, accounts created by hand in the dashboard.** Not magic
  links: Supabase's default email service allows only **2 messages per hour**
  and is explicitly non-production, so link-based sign-in fails unpredictably.
  Revisiting this means setting up custom SMTP or OAuth first — don't switch
  to magic links without that.
- Public sign-up is **disabled** in the Supabase dashboard. There is no
  sign-up page and there shouldn't be one.
- Two enforcement layers, and they are not interchangeable: the
  `redirectOptions.include` list in `nuxt.config.ts` is convenience, the
  storage RLS policy is the real boundary. When adding an editable page, add
  it to `include` *and* make sure a matching policy exists.

## Free-tier limits worth knowing

- **Per-bucket file size limits and MIME restrictions are paid-plan only.**
  Don't suggest configuring them in the dashboard — the option isn't there.
  Free tier has a fixed 50 MB per-file cap and 1 GB total. Size and type are
  therefore enforced client-side in `app/pages/upload.vue`, which is honest
  about being a UX guard rather than a security boundary.
- Default auth email service: **2 messages/hour**, non-production.
- Projects **pause after ~7 days idle** — un-pause before demoing.

## Scope discipline

This is deliberately a proof of concept: a landing page and one photo upload.
Auth, maps, trip records, and campsite data are all **planned but not yet
wanted**. Don't build ahead of what's asked — the point of this cut is to show
the stack works, not to be feature-complete.

## Conventions

- No component library or CSS framework so far — plain scoped CSS in each
  page, dark palette (`#0f172a` background, `#38bdf8` accent).
- Pages live in `app/pages/`.
