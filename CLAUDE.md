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

Proposing is encouraged — write the SQL, sketch the schema, argue for it. What
needs a yes is *executing* it, or shipping code that writes to a new storage
layout. Present the proposal and wait.

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

Storage: a public bucket named `photos`.

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
