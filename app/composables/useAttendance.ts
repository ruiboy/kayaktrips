/**
 * The trips you have marked yourself as having been on.
 *
 * Client-only, for the same reason `useEditor` is: this is a per-reader answer,
 * and putting it in the server response would let a cache hand one person's
 * trips to the next visitor. It is also the only place the browser learns which
 * trips are "mine" — the public payloads carry initials and nothing that ties
 * them to an identity.
 *
 * Shared state rather than a fetch per page, so the trip page's button and the
 * maps filter agree without asking twice.
 */
export function useAttendance() {
  const mine = useState<string[] | null>('attendance-mine', () => null)
  const pending = useState('attendance-pending', () => false)

  async function refresh() {
    if (import.meta.server || pending.value) return
    pending.value = true
    try {
      const answer = await $fetch<{ trip_ids: string[] }>('/api/attendance/mine')
      mine.value = answer.trip_ids
    } catch {
      // Unknown renders the same as none.
      mine.value = []
    } finally {
      pending.value = false
    }
  }

  function was(tripId: string) {
    return (mine.value ?? []).includes(tripId)
  }

  // Folded in rather than refetched, so the button and the initials follow the
  // click rather than a round trip.
  function remember(tripId: string, there: boolean) {
    const rest = (mine.value ?? []).filter((id) => id !== tripId)
    mine.value = there ? [...rest, tripId] : rest
  }

  return { mine, refresh, was, remember }
}
