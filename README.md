# Kayak Trips

An app for recording kayak trips — routes, durations, campsites, and photos.
Public to read; a small number of logged-in users will be able to add and edit
trips.

## Status: proof of concept

This is the earliest cut, built to demonstrate the chosen stack working end to
end. It currently has a landing page and a single photo upload that writes to
Supabase Storage. No auth, no maps, no trip records yet.

Planned next: trip records, manually drawn routes on a map, campsite details,
and login for editors.

## Stack

| Concern    | Choice                                    |
| ---------- | ----------------------------------------- |
| Frontend   | Nuxt 4 (Vue), installable as a PWA        |
| Database   | Supabase (Postgres)                       |
| Photos     | Supabase Storage                          |
| Auth       | Supabase Auth (not wired up yet)          |
| Hosting    | Vercel                                    |
| Maps       | MapLibre + OpenStreetMap (not added yet)  |

## Local setup

Requires Node 22 (see `.nvmrc`):

```bash
nvm use
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag is required — npm 10's dependency resolver
crashes on Nuxt 4's peer dependency graph without it.

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
