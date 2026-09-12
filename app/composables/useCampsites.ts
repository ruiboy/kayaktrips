export const RATINGS = [
  { key: 'bankage', label: 'Bankage' },
  { key: 'campspots', label: 'Campspots' },
  { key: 'firewood', label: 'Firewood' },
  { key: 'shelter', label: 'Shelter' },
  { key: 'aesthetics', label: 'Aesthetics' },
] as const

export type RatingKey = (typeof RATINGS)[number]['key']

export type Campsite = {
  id: string
  name: string
  camped_on: string
  notes: string | null
  lat: number | null
  lon: number | null
  score: number | null
} & Record<RatingKey, number | null>

// The list and the map both need these rows, and the map has to redraw when the
// list changes. `useAsyncData` keyed by trip returns the same refs wherever it's
// called, so both get one fetch and one source of truth — no prop drilling and
// no second request.
export function useCampsites(tripId: MaybeRefOrGetter<string>) {
  const id = computed(() => toValue(tripId))

  return useAsyncData(
    () => `campsites:${id.value}`,
    () => $fetch<Campsite[]>('/api/campsites', { query: { trip: id.value } }),
    { watch: [id] },
  )
}
