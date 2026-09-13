import type { H3Event } from 'h3'

// The grids draw images at 240px at most, but a tile goes full-width on a
// phone, where 3x pixel density asks for about a thousand. 1024 covers that
// and nothing needs more.
export const THUMB_WIDTH = 1024

// Cloudflare defaults to near-lossless, which produces a thumbnail barely
// smaller than the original — measured at 1.6 MB against 366 KB here. The
// quality has to be set explicitly or the whole exercise is pointless.
export const THUMB_QUALITY = 80

/** `<id>.jpg` -> `<id>-thumb.webp`. Derivable, so no column is needed. */
export function thumbKey(storagePath: string): string {
  return `${storagePath.replace(/\.[^.]+$/, '')}-thumb.webp`
}

/** The photo id a thumbnail key belongs to, or null if it isn't one. */
export function idFromThumbKey(key: string): string | null {
  const match = key.match(/^(.+)-thumb\.webp$/)
  return match?.[1] ?? null
}

/**
 * Writes a thumbnail for an object already in R2, and returns its key — or
 * null if one isn't worth storing.
 *
 * Never throws: a trip without a thumbnail still renders, because /img falls
 * back to the original. A failed transform should not fail an upload.
 */
export async function makeThumb(
  event: H3Event,
  storagePath: string,
): Promise<string | null> {
  const env = event.context.cloudflare?.env as { IMAGES?: any } | undefined
  const bucket = photoBucket(event)
  if (!env?.IMAGES) return null

  try {
    const source = await bucket.get(storagePath)
    if (!source) return null

    const result = await env.IMAGES.input(source.body)
      // `scale-down` never enlarges. Without it the already-small images get
      // upscaled to 1024 and come out no smaller than they started.
      .transform({ width: THUMB_WIDTH, fit: 'scale-down' })
      .output({ format: 'image/webp', quality: THUMB_QUALITY })

    const bytes = await result.response().arrayBuffer()

    // Some images are already smaller than anything we'd generate. Storing a
    // thumbnail that loses to its own original helps nobody — the fallback
    // serves the original instead.
    if (bytes.byteLength >= source.size) return null

    const key = thumbKey(storagePath)
    await bucket.put(key, bytes, { httpMetadata: { contentType: 'image/webp' } })
    return key
  } catch {
    return null
  }
}
