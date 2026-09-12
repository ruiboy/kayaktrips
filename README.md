# Kayak Trips

An app for recording kayak trips — routes, durations, campsites, and photos.
Public to read; a small number of logged-in users will be able to add and edit
trips.

## Status

Live at **https://kayaktrips.vixim.workers.dev** (installable — "Add to Home
Screen").

Trip records, campsites with ratings, photos filed against trips, and a map are
all working. Reading is open to everyone; editing needs a signed-in editor.

Everything runs on Cloudflare. It moved there from Vercel + Supabase in
September 2026, because the Supabase free tier caps at 1 GB of storage and
5 GB of egress and pauses after a week idle — and the photos alone were already
86 MB.

## Stack

| Concern    | Choice                                           |
| ---------- | ------------------------------------------------ |
| Frontend   | Nuxt 4 (Vue), installable as a PWA               |
| Hosting    | Cloudflare Workers                               |
| Database   | Cloudflare D1 (SQLite)                           |
| Photos     | Cloudflare R2, private, served by the Worker     |
| Auth       | Cloudflare Access (one-time PIN)                 |
| Maps       | MapLibre + OpenStreetMap                         |

D1 is only reachable from the Worker, so every query lives in `server/api/`
rather than in the browser. That is the biggest structural difference from the
Supabase version, where the browser queried Postgres directly and row-level
security decided what it was allowed to see.

## Local setup

Requires Node 22 (see `.nvmrc`):

```bash
nvm use
npm install
```

`.npmrc` sets `legacy-peer-deps=true`. Don't remove it — npm 10's dependency
resolver crashes on Nuxt 4's peer dependency graph without it.

Copy `.env.example` to `.env` and fill it in. The Cloudflare API token needs
Workers Scripts, D1, R2 and Access permissions:

```bash
CLOUDFLARE_API_TOKEN=your-scoped-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
NUXT_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com
NUXT_ACCESS_AUD=access-application-aud-tag
NUXT_DEV_EDITOR_EMAIL=you@example.com
```

`NUXT_DEV_EDITOR_EMAIL` stands in for an Access login under `npm run dev`,
since Access only runs at the edge. It has no effect in a production build.

Then:

```bash
npm run dev
```

To work against a local copy of the data rather than the live one:

```bash
npx wrangler d1 execute kayaktrips --local --file=db/schema.sql
```

## Install (PWA)

The app is installable from the browser. Chrome and Edge show an "Add this to
your home screen" link on the landing page; iOS Safari gets Share-sheet
instructions instead, because Apple ships no install API and never fires
`beforeinstallprompt`. That event is captured in
`app/plugins/pwa-install.client.ts` rather than in the component, since it can
fire before anything mounts.

`@vite-pwa/nuxt` builds and serves the manifest but does **not** link it from
the page. The `<link rel="manifest">` in `nuxt.config.ts` is what makes the app
discoverable as installable; remove it and no install affordance ever appears.

### Icons

Every icon, and the landing page badge, comes from `public/mkt-crew.jpg` — the
Mega Kayak Trip Crew sticker. That file is the source, kept for regeneration;
nothing links to it directly.

The sticker is drawn on a near-white field, so the background is removed by
flooding inward from the edges rather than by replacing white globally — the
artwork's own white (the lettering, the river, the stars) would otherwise be
punched through. The cut-out is then centred on `#0f172a`, matching the
manifest's `background_color`:

- `mkt-crew.png` — the cut-out itself, 768px, palette-quantised to 256 colours
  (145 KB rather than 800 KB, with no visible loss on flat artwork). The
  landing page draws it with a `drop-shadow` so the shadow follows the shield
  rather than a box.
- `icon-192`, `icon-512`, `apple-touch-icon` — art at 92% of the canvas.
- `icon-maskable-512` — art at 72%, inside the safe zone launchers crop to.

`nuxt.config.ts` lists which sizes are wired up.

## Auth

Public read, gated editing, enforced in two places that are **not**
interchangeable.

**Cloudflare Access** covers the two editor pages, `/upload` and `/trips/new`.
Visiting one gets you a Cloudflare login: enter an allowlisted email, get a
six-digit code, and the session lasts a month. There is no login page in this
app, no users table, and no password handling.

**Every write route** separately verifies the Access token
(`requireEditor()` in `server/utils/access.ts`). Both layers are needed:

- Access matches on **path and cannot see the HTTP method**. `/api/trips`
  serves public reads and editor writes on the same path, so putting Access in
  front of `/api/` would take the public site down with it.
- Editing a trip inline — badge, campsites, the trip editor — happens on
  `/trips/<slug>`, a **public** page where Access never runs. Only the route
  check protects it.

When adding an editable page, add it to the Access application's destinations
*and* make sure its routes call `requireEditor()`.

The identity that reaches the app is an **email address**, which is what
`uploaded_by` and `created_by` store. There is no foreign key behind them —
accounts live in Access, not in the database.

### Adding an editor

Zero Trust → Access → Applications → "Kayak Trips — editing" → Policies →
Editors → Include → Emails. Dashboard config; no deploy.

### What the routes guarantee

The client never names a storage key or an uploader. The upload route generates
the key from a fresh id and the validated MIME type, and takes the uploader from
the verified token; the delete route accepts a photo **id** and looks the key up
itself. Under Supabase a storage policy checked the path's first segment —
nothing replaces that check except not trusting the client at all.

## Deployment

```bash
npm run build
npx wrangler deploy
```

`wrangler.jsonc` holds the bindings (`DB`, `PHOTOS`, `ASSETS`) and the Access
variables. The only real secret is the Cloudflare API token in `.env`; the
Access team domain and AUD are public identifiers and live in the config.

Pushing to `main` publishes the repo but does **not** deploy — that is a
separate, deliberate step.

## Free-plan limits

- **Workers**: 100k requests/day, 10 ms CPU each. Static assets don't count.
- **D1**: 5 GB, 5M row reads and 100k row writes/day.
- **R2**: 10 GB, egress free. Currently 86 MB across 30 photos.
- **Access**: 50 users.
- **Nothing pauses**, which was the point of the move.
- **Nothing is backed up.** `db/schema.sql` is the schema's only written
  record and nothing detects drift. The photos remain the least protected
  thing here and the only part that couldn't be retyped.
- Upload limits (10 MB, image types) are enforced in
  `server/api/photos/index.post.ts` — a real boundary, unlike the client-side
  check that preceded it.

## Nuxt commands

Start the development server on `http://localhost:3000`:

```bash
npm run dev
```

Build the application for production:

```bash
npm run build
```

Locally preview the production build:

```bash
npm run preview
```

See the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction)
and the [deployment documentation](https://nuxt.com/docs/getting-started/deployment)
for more.
