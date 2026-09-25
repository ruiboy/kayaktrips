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
- **Cloudflare for everything**: Workers (hosting and server routes), D1
  (database), R2 (photos), Access (auth). Chosen for a free tier that fits a
  personal project without a ceiling in sight — 10 GB of object storage with
  egress free — and because nothing pauses when the site sits quiet.
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
| Worker | `kayaktrips` → `https://kayaktrips.vixim.net` (Custom Domain; the `workers.dev` route is disabled) |
| D1 | `kayaktrips`, id `5fd4f60f-c024-49b4-8cf8-20950fde060f`, region OC |
| R2 | `kayaktrips-photos`, region OC, **private** |
| Access | team `vixim.cloudflareaccess.com`, app "Kayak Trips" |
| Domain | `vixim.net` is the owner's umbrella, not this app's — hence the `kayaktrips.` subdomain, leaving room for siblings |

Bindings live in `wrangler.jsonc`: `DB`, `PHOTOS`, `ASSETS`, `IMAGES`.

⚠️ **Deploy with `npm run deploy`, never bare `wrangler deploy`.** It builds,
stamps `.output/public/_build-id.txt` with the commit and time, then deploys.
The stamp is load-bearing: cloudflare/workers-sdk#12586 makes the asset upload
session return empty buckets for genuinely new assets, so wrangler prints "No
updated asset files to upload" and the previous build keeps serving — while the
build, the upload, the version and the deployment all report success. One
guaranteed-changed asset per build makes it process the whole manifest.

**Check `https://kayaktrips.vixim.net/_build-id.txt` after deploying.**
If it doesn't match `git rev-parse --short HEAD`, the deploy didn't land, and
nothing else will tell you.

If a hostname gets stuck on a stale manifest anyway — the stamp did not rescue
this Worker once it had — `wrangler delete --name kayaktrips` then redeploy.
Safe: the data is in D1 and R2, every binding is declared in wrangler.jsonc,
and the Access application points at the hostname rather than the script.

**No migration files yet**, same as before — that ceremony isn't worth it until
there's real user data. When it is, D1 has `wrangler d1 migrations`.

⚠️ **The schema lives in `db/schema.sql` and in D1, and nothing detects drift.**
The file is hand-maintained — if you change the schema, update it in the same
commit and re-run it.

Storage: R2 objects are keyed `<photo-id>.<ext>`, flat, no folders. The bucket
is private; `server/routes/img/[key].get.ts` serves the bytes with an immutable
cache header. There is no public bucket URL and no custom domain.

`scripts/export-from-supabase.mjs` reads the archived project described under
"Free-tier limits" and writes `db/seed.sql`, `db/photos/` and
`db/users.local.json` — all gitignored, because they carry real email addresses
and this repo is public. It is also how you'd re-seed a local database.

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
- **The database enforces nothing about who may write.** SQLite has no
  row-level security, so `requireEditor()` in `server/utils/access.ts` is the
  boundary: it verifies the Cloudflare Access token, and `uploaded_by` comes
  from that token rather than from the request, which is what stops one person
  posting as another.
- **The client never names a storage key.** The upload route generates it from
  a fresh id and the validated MIME type. Deliberate: a route that accepted a
  path would let one editor overwrite another's object, and nothing catches
  that except never trusting the client with it.
- **Deleting removes the row first, then the object**
  (`server/api/photos/[id].delete.ts`). The other order can leave a row
  pointing at a missing file — a broken tile; this order can only leave an
  orphaned object, which nothing lists. The client sends an id, never a path,
  so only a row can name a file for deletion.
- **`trip_id` is nullable and means "not filed under a trip".** Rows that
  predate trips stay NULL, and filing still happens at upload time only — the
  picker on `/upload` sets it on insert.
- **`PhotoDialog` is the only way to change a photo**, and it lives on both the
  trip page and the gallery. The gallery needs it more: a photo with no
  `trip_id` has no trip page, so before this there was nowhere to edit or
  delete it from at all.
- **`PATCH /api/photos/<id>` edits the caption and nothing else.** Its
  allowlist is one field long deliberately: fixing a typo is worth allowing,
  re-filing a photo is not, since `trip_id` is what the gallery and the trip
  page split on. An emptied caption stores NULL rather than `''`, because the
  templates test for null to decide whether to render the line.

Orphans are not possible: the upload route deletes the object it just wrote if
the row insert fails, so the bucket and the table cannot disagree.

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
- **`trips` and `photos` reference each other**, so anything inserting both
  has to write trips with a null badge first and backfill it. Reads join the
  two rather than embedding, since the relationship runs both ways and a join
  says which direction it means.
- **`badge_photo_id` and `PATCH /api/trips/<slug>`**: the route allowlists the
  fields it will write, so a request cannot reach `slug` or `created_by`.
- Nothing constrains the badge to a photo *of* that trip; only the UI does.
  A composite FK or trigger would enforce it, and isn't worth it yet.
- **The badge is chosen inside the trip editor and saved with the trip**, not
  written through on click, so abandoning an edit leaves it as it was.
  `BadgePickerDialog` nests inside the editor the way `MapPickerDialog` does —
  native `<dialog>` uses the top layer, so stacking is fine.
- **`DELETE /api/trips/<slug>`** exists and is reached from the trip editor
  behind typing the trip's title. Campsites cascade with it; photos survive
  with `trip_id` NULL and their storage objects are untouched.

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

### `links`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | PK — a uuid generated in app code |
| `trip_id` | `text` | not null, FK → `trips`, **`on delete cascade`** |
| `url` | `text` | not null — as pasted, normalised by `URL` |
| `label` | `text` | nullable — what to call it; falls back to the host |
| `created_by` | `text` | the Access email, nullable. No FK |
| `created_at` | `text` | not null, ISO 8601 UTC |

Design intent worth preserving:

- **No `kind` column.** Whether a URL is an embeddable video is worked out at
  render time by `app/utils/links.ts`, the same way a photo's URL is worked out
  from its storage path. A stored kind is a second answer that can disagree
  with the URL it describes.
- **No `position`, and no `unique (trip_id, url)`.** `created_at` orders them
  until reordering is actually wanted, and the same video at two timestamps is
  a real thing to want.
- **`cleanUrl()` in `server/utils/links.ts` is the boundary**, and it refuses
  anything but `http:` and `https:`. Only editors can write a link, but
  everyone reads one back as an `href` — a stored `javascript:` URL is a script
  the public runs by clicking a trip's own page. Nothing else in this app puts
  a reader-supplied string into an attribute.
- **Cascade, like campsites.** A link to a trip's video has no meaning once the
  trip is gone. The trip delete route counts links alongside campsites so the
  confirmation says what it is about to destroy.
- **YouTube embeds are lazy and `nocookie`.** `youtube-nocookie.com` is
  YouTube's own host for this and sets no tracking cookie until you press play;
  `loading="lazy"` holds back the player — about a megabyte of JavaScript —
  until the frame is nearly in view. If a trip ever carries several videos, the
  next step is a click-to-play facade (the thumbnail from `i.ytimg.com`, swap in
  the iframe on click), not a heavier page.
- Anything that isn't a single YouTube video renders as a plain link, including
  a YouTube channel or playlist URL — there is nothing there to embed.
- **Links live in the second column of the trip page, under the photos.**

### `people` and `attendances`

| Column | Type | Notes |
| --- | --- | --- |
| `people.id` | `text` | PK — a uuid generated in app code |
| `people.email` | `text` | not null, **unique**, `collate nocase` — the Access address |
| `people.initials` | `text` | not null, **unique**, 1–3 characters |
| `people.created_at` | `text` | not null, ISO 8601 UTC |
| `attendances.trip_id` | `text` | not null, FK → `trips`, `on delete cascade` |
| `attendances.person_id` | `text` | not null, FK → `people`, `on delete cascade` |
| `attendances.created_at` | `text` | not null, ISO 8601 UTC |

`attendances` has no surrogate key: `(trip_id, person_id)` is the primary key,
because one person, one trip, once *is* the rule.

Design intent worth preserving:

- ⚠️ **An email address lives in exactly one row of one table.** That is the
  whole point of the uuid key — every other table refers to `people.id`, so any
  query that could return an address has had to join `people` to get one, and
  reviewing for leaks is reviewing the joins. **No public response may carry an
  email.** The trip page returns initials; the maps filter is served by
  `GET /api/attendance/mine`, which is authenticated and returns trip ids only,
  precisely so the public payload never needs a "this one is you" marker.
- **The person comes from the verified token, never from the request.** Same
  rule as `uploaded_by`, and here it is what makes "I was there" a statement
  about yourself that no editor can make about anyone else. Deliberate: with
  five people it would be convenient for the organiser to tick everyone off,
  and the click is what makes appearing on a public page a choice.
- ⚠️ **The registry is filled in by hand, and an editor without a row cannot
  mark attendance.** Adding a sixth person is now two steps — the Access policy
  *and* a `people` row — which is a new way to be half-configured. The UI hides
  the control rather than offering one that can only fail; the route answers
  403 if a request arrives anyway. Seed from `db/people.local.sql`, which is
  gitignored because it holds real addresses.
- **`initials` is unique and there is no `name`.** The initials are the entire
  display, so two people showing as "S" would tell a reader nothing. They are
  assigned by hand, so uniqueness is a promise the data can keep rather than a
  write that fails at an awkward moment.
- **Cascades from both ends.** A photo outlives the account that posted it
  because the photo is the record; an attendance *is* the attribution, so when
  either end goes there is nothing left for it to mean.
- **`photos.uploaded_by` and `trips.created_by` still store emails**, and stay
  that way deliberately. They are an audit trail written from the token and
  never rendered, not a relationship — migrating historical rows to `person_id`
  would be risk without a visible gain.
- **The Mine/All filter on `/maps` resets to All on every visit.** The page
  exists to show the whole river; a filter left on from last week would be a
  quiet lie about how much is there.

## Environment

- **Node 22** (`.nvmrc`). Several transitive deps require it; Node 20 produces
  engine warnings.
- **`legacy-peer-deps=true` in `.npmrc` is load-bearing.** Without it npm 10's
  arborist crashes with `Cannot read properties of null (reading 'edgesOut')`
  on Nuxt 4's peer graph. Don't "tidy" it away.
- Secrets live in `.env` (gitignored). `.env.example` documents the shape. The
  Cloudflare API token is the only real secret; the Access team domain and AUD
  are public identifiers and live in `wrangler.jsonc`.
- **The Cloudflare token expires 2027-09-30.** A lapsed one fails deploys with
  a 403 and the cause isn't obvious from the error.

## Auth

- **Cloudflare Access, One-time PIN.** The allowlist is a list of emails in the
  Access policy — dashboard config, not code. There is no password handling and
  no sign-up page. The `people` table is a display registry — initials for a
  public page — and authorises nothing; Access remains the only authority on
  who may write. Adding an editor means both, and in that order. Team domain is
  `vixim.cloudflareaccess.com`; sessions last a month.
- ⚠️ **One-time PIN has to be added as an identity provider.** It is the default
  *only when no provider exists at all*. The account had Cloudflare's own
  "Cloudflare" integration, so the login page offered nothing but a Cloudflare
  account sign-in — which sent a first-time editor to dash.cloudflare.com
  asking for a password he had no way to have. Fixed by adding One-time PIN
  (Zero Trust → Integrations → Identity providers) and deleting the Cloudflare
  one. The application also has `auto_redirect_to_identity` on, so with a
  single provider there is no chooser screen at all.
- ⚠️ **`GET /accounts/:id/access/identity_providers` lies to this token.** It
  answers `success: true` with an empty list while the dashboard shows
  providers. Don't infer login configuration from it — open the login page.
- **Signing in is a navigation, not a page.** `AccountControl.vue` links to
  `/signin` with a plain `<a>`; Access challenges at the edge and the page
  bounces you back to wherever you clicked from. A client-side route change
  never reaches the edge, so `NuxtLink` would silently not log you in.
  Sign-out is Access's `/cdn-cgi/access/logout`.
- **`/signin` exists only to be gated.** It renders nothing and holds no logic
  beyond the bounce. It replaced pointing "Sign in" at `/upload`, which worked
  but sent first-time editors to an upload form and lost them. Its `?next=`
  honours internal paths only — anyone can reach the page, so an absolute URL
  there would be an open redirect.
- **Two layers, and they are not interchangeable.** Access covers `/signin`
  and the two editor *pages* (`/upload`, `/trips/new`). Every write route separately
  verifies the token via `requireEditor()`. Both are needed:
  - Access matches on **path and cannot see the method**. `/api/trips` serves
    public GETs and editor POSTs on one path, so gating it would take the
    public site down. Never put Access in front of `/api/`.
  - Inline editing on `/trips/<slug>` happens on a **public** page, where
    Access never runs. Only the route check protects it.
  When adding an editable page, add it to the Access application's destinations
  *and* make sure its routes call `requireEditor()`.
- ⚠️ **Access destinations are per hostname.** They name
  `kayaktrips.vixim.net` explicitly, so putting the Worker on another hostname
  leaves the editor pages ungated there until they are added. The write routes
  would still refuse, so nothing could be changed — but the pages would be
  reachable. Add the destinations *before* the hostname starts resolving.
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
- **Nothing pauses**, which is why the stack is worth its constraints.
- ⚠️ **An archived Supabase project is kept on purpose, paused, as the only
  off-Cloudflare copy of the photo originals.** R2 has no backups and no
  versioning, and the 86 MB of originals are the one thing here that can't be
  retyped. A paused free project is restorable from the dashboard for a year,
  costs nothing, and needs no attention — so leave it paused rather than
  un-pausing or deleting it. Delete it once R2 has a backup story.
- Upload size and type are enforced in `server/api/photos/index.post.ts`
  (10 MB, MIME allowlist). The check in `app/pages/upload.vue` is a UX guard,
  not a boundary.
- **The grids serve thumbnails, the click-through serves the original.** That
  matters more than it sounds: `/photos` lays out 208px tiles, and serving the
  4000x3000 originals into them made the page 86 MB — 72 seconds on a 10 Mbps
  phone. It is now about 5 MB. Storage is free here, so nothing is gained by
  shrinking what was uploaded; the waste was only ever in what was sent.

## Scope discipline

Trips, campsites, photos, maps and auth are all built and working. This is
still a personal project at personal scale — don't build ahead of what's asked.

## Conventions

- No component library or CSS framework so far — plain scoped CSS in each
  page, dark palette (`#0f172a` background, `#38bdf8` accent).
- Pages live in `app/pages/`.
- **Editing is a pencil, deleting lives in the dialog it opens.** `EditButton`
  is the one affordance for "change this"; no Delete sits on a page where a
  reader could reach it. This was arrived at by trying it three ways: on photos
  the pencil runs inline after the caption text, so a wrapped caption keeps it
  with the last word rather than leaving a row of pencils at ragged heights —
  and it stays off the image, which is the thing worth looking at.
- **`SiteNav` on every page below the landing.** Breadcrumbs came first and
  were wrong for a site two levels deep — "Home / Trips" spent a line saying
  what the heading already said. A nav moves you sideways instead, from a trip
  straight to the photos. The badge is the way home, so no crumb has to be —
  the artwork survives a narrow screen where a two-word mark would wrap. The
  current section is underlined rather than only coloured, since on this
  palette a colour change alone reads as hover. The account control is an initial in a
  disc opening a menu with the address and the way out — a bare "Sign out"
  button spent the widest thing in the top row on the action you want least
  often, and a visible address before that pushed the nav onto a third row on a
  phone. The menu light-dismisses on an outside click or Escape, which is
  hand-wired: `<dialog>` is modal and `<details>` ignores clicks elsewhere.
- **Map colours come from `app/utils/mapColours.ts`**, not from TripMap.vue —
  `<script setup>` cannot carry ES exports, only type exports, so a palette
  shared with the page that lists the trips has to live outside the component.
