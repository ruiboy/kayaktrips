import type { H3Event } from 'h3'

// The D1 and R2 handles arrive as Worker bindings, declared in wrangler.jsonc
// and injected by Nitro's cloudflare preset. `nitro-cloudflare-dev` supplies
// the same shape to `nuxt dev`, so nothing here branches on environment.
type Bindings = {
  DB: D1Database
  PHOTOS: R2Bucket
}

function bindings(event: H3Event): Bindings {
  const env = event.context.cloudflare?.env as Bindings | undefined
  if (!env?.DB) {
    // Worth failing loudly: a missing binding means the deploy is
    // misconfigured, and every query below would otherwise fail one by one
    // with something far less obvious.
    throw createError({
      statusCode: 500,
      statusMessage: 'Cloudflare bindings unavailable',
    })
  }
  return env
}

export function db(event: H3Event): D1Database {
  return bindings(event).DB
}

export function photoBucket(event: H3Event): R2Bucket {
  return bindings(event).PHOTOS
}

// D1 returns `{ results }` for selects. Everything here reads rows rather than
// counting them, so this is the only shape worth wrapping.
export async function all<T>(stmt: D1PreparedStatement): Promise<T[]> {
  const { results } = await stmt.all<T>()
  return results ?? []
}

export async function first<T>(stmt: D1PreparedStatement): Promise<T | null> {
  return (await stmt.first<T>()) ?? null
}

// SQLite has no gen_random_uuid(); ids are the app's job now.
export function newId(): string {
  return crypto.randomUUID()
}

// ISO 8601, always UTC, matching the `text` timestamp columns.
export function nowIso(): string {
  return new Date().toISOString()
}
