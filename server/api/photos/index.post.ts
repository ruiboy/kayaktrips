// The upload. Everything that decides *where* the file lands is computed here
// from the verified identity and a fresh id — nothing in the request can name
// a key, so one editor cannot overwrite another's object. That property used
// to come free from the storage RLS policy checking the path's first segment.

const MAX_BYTES = 10 * 1024 * 1024

// Extension comes from the validated MIME type, not the client's filename.
// Anything not on this list is refused outright.
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
}

export default defineEventHandler(async (event) => {
  const email = await requireEditor(event)

  const form = await readMultipartFormData(event)
  const file = form?.find((part) => part.name === 'file' && part.filename)
  if (!file) throw createError({ statusCode: 400, statusMessage: 'No file' })

  const field = (name: string) => {
    const part = form?.find((p) => p.name === name && !p.filename)
    return part ? part.data.toString('utf8') : ''
  }

  const type = file.type ?? ''
  const ext = EXT_BY_TYPE[type]
  if (!ext) {
    throw createError({ statusCode: 415, statusMessage: `Unsupported image type: ${type || 'unknown'}` })
  }
  // Enforced here rather than only in the browser. The old client-side guard
  // was honest about being a UX check; this one is the actual boundary.
  if (file.data.byteLength > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Images must be 10 MB or smaller' })
  }

  const id = newId()
  const storage_path = `${id}.${ext}`
  const tripId = field('trip_id') || null
  const caption = field('caption').trim() || null

  await photoBucket(event).put(storage_path, file.data, {
    httpMetadata: { contentType: type },
  })

  try {
    await db(event)
      .prepare(
        `insert into photos (id, storage_path, uploaded_by, caption, trip_id, created_at)
         values (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, storage_path, email, caption, tripId, nowIso())
      .run()
  } catch (error) {
    // Supabase left the file orphaned when the row failed. Here both sides are
    // ours, so undo the half that succeeded rather than leaving litter.
    await photoBucket(event).delete(storage_path).catch(() => {})
    throw error
  }

  // Non-fatal on purpose: the photo is filed either way, and a failed badge
  // update shouldn't read as a failed upload.
  let badgeError: string | null = null
  if (field('badge') === 'true' && tripId) {
    try {
      await db(event)
        .prepare('update trips set badge_photo_id = ? where id = ?')
        .bind(id, tripId)
        .run()
    } catch (error) {
      badgeError = String((error as Error)?.message ?? error)
    }
  }

  return { id, storage_path, badgeError }
})
