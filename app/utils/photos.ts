// Rows hold storage keys, never URLs — the same decision as before, so the
// bucket can move without rewriting rows. The difference now is that the
// bucket is private and the Worker serves the bytes, so this points at our
// own route rather than at a public bucket URL.
export function photoUrl(storagePath: string): string {
  return `/img/${storagePath}`
}
