/**
 * The URL a link row may store, or null if it isn't one.
 *
 * The scheme check is the point. Only editors can write a link, but everyone
 * reads one back as an `href` — and a stored `javascript:` URL is a script the
 * public runs by clicking a trip's own page. Nothing else here can put markup
 * or code into a page, and this shouldn't be the exception.
 */
export function cleanUrl(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw || raw.length > 2048) return null

  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return parsed.toString()
  } catch {
    return null
  }
}
