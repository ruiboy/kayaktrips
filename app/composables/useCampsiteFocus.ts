/**
 * The campsite the page has been asked to show, and when it was asked.
 *
 * A popup on the trip's own map and the campsite list are siblings with the
 * page between them, and the URL alone can't carry this: clicking the same
 * marker twice leaves the hash exactly as it was, so nothing would fire and
 * the second click would do nothing. The timestamp is what makes a repeat ask
 * a new one.
 *
 * The hash is still set, because it is what makes a campsite linkable from
 * anywhere else; this only covers the case where the URL cannot change.
 */
export function useCampsiteFocus() {
  return useState<{ id: string; at: number } | null>('campsite-focus', () => null)
}
