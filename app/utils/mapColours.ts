// Lives here rather than in TripMap.vue because `<script setup>` cannot carry
// ES exports — only type exports — and both the map and the list beneath it
// need to agree on which colour belongs to which trip.
//
// Enough hues to tell a handful of trips apart at a glance, legible on the dark
// palette and distinguishable from one another. Cycled, so a ninth trip repeats
// the first; by then the list is doing more work than the colour is.
export const TRIP_COLOURS = [
  '#38bdf8',
  '#fbbf24',
  '#4ade80',
  '#f472b6',
  '#a78bfa',
  '#fb923c',
  '#2dd4bf',
  '#e879f9',
]

export function tripColour(index: number): string {
  return TRIP_COLOURS[index % TRIP_COLOURS.length]!
}
