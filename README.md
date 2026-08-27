# Kayak Trips

An app for recording kayak trips — routes, durations, campsites, and photos.
Public to read; a small number of logged-in users will be able to add and edit
trips.

## Status: proof of concept

Live at **https://kayaktrips.vercel.app** (installable — "Add to Home Screen").

This is the earliest cut, built to demonstrate the chosen stack working end to
end. It has a landing page, a public photo gallery, and a photo upload for
signed-in editors. No maps and no trip records yet.

Uploading requires a signed-in editor; reading is open to everyone. See
"Auth" below.

Planned next: trip records, manually drawn routes on a map, and campsite
details.

## Stack

| Concern    | Choice                                    |
| ---------- | ----------------------------------------- |
| Frontend   | Nuxt 4 (Vue), installable as a PWA        |
| Database   | Supabase (Postgres)                       |
| Photos     | Supabase Storage                          |
| Auth       | Supabase Auth (email + password)          |
| Hosting    | Vercel                                    |
| Maps       | MapLibre + OpenStreetMap (not added yet)  |

## Local setup

Requires Node 22 (see `.nvmrc`):

```bash
nvm use
npm install
```

`.npmrc` sets `legacy-peer-deps=true`. Don't remove it — npm 10's dependency
resolver crashes on Nuxt 4's peer dependency graph without it, both locally
and on Vercel.

Copy `.env.example` to `.env` and fill in the values from your Supabase
project (Project Settings → API):

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-public-key
```

Supabase Storage needs a public bucket named `photos` for uploads to work.

Then:

```bash
npm run dev
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

### Icons and the launch screen

Everything comes from `public/mkt-badge.jpg`, the Mega Kayak Trip X sticker:

| File | Used for |
| --- | --- |
| `icon-192.png`, `icon-512.png` | Manifest icons |
| `icon-maskable-512.png` | Launchers that crop icons to their own shape |
| `apple-touch-icon.png` | iOS home screen |
| `favicon.ico` | Browser tab |

The badge is circle-cropped onto the `#0f172a` background, slightly overscaled
to hide the benchtop it was photographed on. Android composes the launch
screen from the 512px icon, `background_color`, and `name` — there is no
separate splash asset to maintain. iOS only shows a launch image if per-device
`apple-touch-startup-image` files are supplied; none are, so it flashes the
background colour instead.

## Auth

Public read, gated editing. `/upload` requires a session; everything else is
open. Enforced in two places, deliberately:

- **Route level** — `redirectOptions.include` in `nuxt.config.ts` lists the
  paths that require a session. Add to it as editable pages appear.
- **Database level** — a Supabase policy restricting inserts on the `photos`
  bucket to the `authenticated` role:

  ```sql
  create policy "Authenticated can upload to photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');
  ```

The route guard is a convenience; the storage policy is the actual security
boundary. Never rely on the former alone.

### Accounts are created by hand

There is no sign-up flow, and **"Allow new users to sign up" is turned off** in
the Supabase dashboard. To add an editor: Authentication → Users → Add user,
with "Auto Confirm User" ticked.

Sign-in is email + password rather than magic links because Supabase's default
email service is capped at **2 messages per hour** and isn't meant for
production. Magic links would fail unpredictably during a demo. Switching to
magic links or OAuth later means wiring up custom SMTP (Resend et al.) or an
OAuth provider first.

## Deployment

Hosted on Vercel, auto-deploying from `main`. `SUPABASE_URL` and
`SUPABASE_KEY` are set in the Vercel project's environment variables — the
local `.env` is gitignored and never leaves your machine, so the two must be
kept in sync by hand.

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
