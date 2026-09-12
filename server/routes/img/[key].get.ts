// Photos are served through the Worker rather than from a public bucket URL.
// That keeps R2 private, costs nothing extra (R2 egress is free and the CDN
// caches the response), and means no custom domain is needed.
// Keys carry their extension, so the type is recoverable even if an object was
// stored without one — an octet-stream lands as a download prompt rather than
// an image, which is a bad way to find out.
const TYPE_BY_EXT: Record<string, string> = {
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

  const object = await photoBucket(event).get(key)
  if (!object) throw createError({ statusCode: 404, statusMessage: 'No such image' })

  // A photo's bytes never change — there is no update path, and a re-upload
  // gets a new id and therefore a new key — so this can be cached hard.
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
  setHeader(event, 'etag', object.httpEtag)
  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  setHeader(
    event,
    'content-type',
    object.httpMetadata?.contentType ??
      TYPE_BY_EXT[ext] ??
      'application/octet-stream',
  )
  return object.body
})
