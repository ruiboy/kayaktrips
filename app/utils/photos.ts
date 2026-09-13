// Rows hold storage keys, never URLs — the same decision as before, so the
// bucket can move without rewriting rows. The difference now is that the
// bucket is private and the Worker serves the bytes, so this points at our
// own route rather than at a public bucket URL.
export function photoUrl(storagePath: string): string {
  return `/img/${storagePath}`
}

// The grid tiles. Derived rather than stored — the key is the photo's own id,
// so no column is needed. If the thumbnail doesn't exist, /img serves the
// original instead, so this is always safe to call.
export function thumbUrl(storagePath: string): string {
  return `/img/${storagePath.replace(/\.[^.]+$/, '')}-thumb.webp`
}
