// A link is stored as the URL that was pasted, and nothing else. What it turns
// into on the page is worked out here, at render time — the same decision as
// photo URLs being derived from storage paths rather than stored. A `kind`
// column would be a second answer that can disagree with the URL it describes.

/** YouTube ids are eleven characters of this alphabet, always. */
const VIDEO_ID = /^[\w-]{11}$/

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
])

/** `90`, `1m30s`, `1h2m3s` — the forms YouTube's own share links produce. */
function seconds(value: string | null): number | null {
  if (!value) return null
  if (/^\d+$/.test(value)) return Number(value)

  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!match || !match[0]) return null
  const [, h, m, s] = match
  const total = Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0)
  return total || null
}

/**
 * The id and start offset of a YouTube link, or null for anything else —
 * including a YouTube URL that names no single video, like a channel or a
 * playlist, which has nothing to embed.
 */
export function youtubeVideo(url: string): { id: string; start: number | null } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null

  const path = parsed.pathname.split('/').filter(Boolean)
  // youtu.be/<id>, and the three shapes youtube.com uses for one video.
  const id =
    parsed.hostname.endsWith('youtu.be')
      ? path[0]
      : path[0] === 'watch'
        ? (parsed.searchParams.get('v') ?? undefined)
        : ['shorts', 'embed', 'live'].includes(path[0] ?? '')
          ? path[1]
          : undefined

  if (!id || !VIDEO_ID.test(id)) return null

  return {
    id,
    start: seconds(parsed.searchParams.get('t') ?? parsed.searchParams.get('start')),
  }
}

/**
 * Where the embed is served from. `youtube-nocookie.com` is YouTube's own
 * domain for this and sets no tracking cookie until the video is played.
 */
export function youtubeEmbedUrl(video: { id: string; start: number | null }): string {
  const start = video.start ? `?start=${video.start}` : ''
  return `https://www.youtube-nocookie.com/embed/${video.id}${start}`
}

/**
 * What a plain link calls itself. The label if one was given, otherwise the
 * host — which is short, honest, and says more about where you're being sent
 * than a truncated URL does.
 */
export function linkText(url: string, label: string | null): string {
  if (label) return label
  try {
    // A scheme with no host — `mailto:`, and the ones the write route refuses —
    // would otherwise render as a link with nothing in it.
    return new URL(url).hostname.replace(/^www\./, '') || url
  } catch {
    return url
  }
}
