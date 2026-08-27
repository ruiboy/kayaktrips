# CLAUDE.md

Decisions already made for this project. Don't relitigate these — if one looks
wrong, raise it rather than quietly switching.

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

Storage: a public bucket named `photos`.

## Environment

- **Node 22** (`.nvmrc`). Several transitive deps require it; Node 20 produces
  engine warnings.
- **`npm install --legacy-peer-deps` is required.** npm 10's arborist crashes
  with `Cannot read properties of null (reading 'edgesOut')` on Nuxt 4's peer
  graph otherwise. This is not optional and not a fluke.
- Secrets live in `.env` (gitignored). `.env.example` documents the shape.

## Scope discipline

This is deliberately a proof of concept: a landing page and one photo upload.
Auth, maps, trip records, and campsite data are all **planned but not yet
wanted**. Don't build ahead of what's asked — the point of this cut is to show
the stack works, not to be feature-complete.

## Conventions

- No component library or CSS framework so far — plain scoped CSS in each
  page, dark palette (`#0f172a` background, `#38bdf8` accent).
- Pages live in `app/pages/`.
