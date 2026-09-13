// Photos are served through the Worker rather than from a public bucket URL.
// That keeps R2 private, costs nothing extra (R2 egress is free and the CDN
// caches the response), and means no custom domain is needed.
// Keys carry their extension, so the type is recoverable even if an object was
// stored without one — an octet-stream lands as a download prompt rather than
// an image, which is a bad way to find out.
const TYPE_BY_EXT: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  heic: 'image/heic',
}

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')
  if (!key) throw createError({ statusCode: 400, statusMessage: 'No key' })

  let object = await photoBucket(event).get(key)
  // The key actually served, which is not the key requested when a thumbnail
  // is missing and the original stands in for it.
  let servedKey = key

  // A thumbnail is optional: it may not have been generated, or may have lost
  // to its own original on size. Serving the full image is slower than the
  // thumbnail and better than a broken tile.
  if (!object) {
    const id = idFromThumbKey(key)
    if (id) {
      const row = await first<{ storage_path: string }>(
        db(event).prepare('select storage_path from photos where id = ?').bind(id),
      )
      if (row) {
        object = await photoBucket(event).get(row.storage_path)
        servedKey = row.storage_path
      }
    }
  }

  if (!object) throw createError({ statusCode: 404, statusMessage: 'No such image' })

  // A photo's bytes never change — there is no update path, and a re-upload
  // gets a new id and therefore a new key — so this can be cached hard.
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
  setHeader(event, 'etag', object.httpEtag)
  // From the served key, not the requested one — otherwise a PNG standing in
  // for a missing thumbnail goes out labelled image/webp.
  const ext = servedKey.split('.').pop()?.toLowerCase() ?? ''
  setHeader(
    event,
    'content-type',
    object.httpMetadata?.contentType ??
      TYPE_BY_EXT[ext] ??
      'application/octet-stream',
  )
  return object.body
})
