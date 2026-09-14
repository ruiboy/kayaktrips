<script setup lang="ts">
import type { MapPoint } from '~/components/TripMap.vue'

useHead({
  title: 'Maps — Kayak Trips',
})

type TripRow = {
  id: string
  slug: string
  title: string
  start_place: string | null
  end_place: string | null
  start_lat: number | null
  start_lon: number | null
  end_lat: number | null
  end_lon: number | null
}

type CampsiteRow = {
  id: string
  trip_id: string
  name: string
  camped_on: string
  lat: number | null
  lon: number | null
}

// Public read, so this renders server-side for anonymous visitors too. Both
// halves come back in one request now rather than two parallel queries.
// `useRequestFetch`, not bare `$fetch`: on Workers an internal fetch starts a
// fresh event without `context.cloudflare`, so the route would find no D1
// binding and fail server-side. This one carries the current event's context
// (and its cookies) through.
const requestFetch = useRequestFetch()
const { data, error } = await useAsyncData('all-map-points', () =>
  requestFetch<{ trips: TripRow[]; campsites: CampsiteRow[] }>('/api/map'),
)

// Which trip the reader has picked out, or null for "all of them". Clicking
// the same trip again clears it, so there is always a way back to the overview
// without hunting for a button.
const focusedTripId = ref<string | null>(null)

function toggleFocus(tripId: string) {
  focusedTripId.value = focusedTripId.value === tripId ? null : tripId
}

// One colour per trip, assigned in the order they appear and cycled once the
// palette runs out. The list beneath the map reads from the same map, so a
// swatch there always matches the pins.
const colourOf = computed(() => {
  const byTrip = new Map<string, number>()
  ;(data.value?.trips ?? []).forEach((trip, index) => byTrip.set(trip.id, index))
  return byTrip
})

function swatch(tripId: string) {
  return tripColour(colourOf.value.get(tripId) ?? 0)
}

// Every trip's points on one map. Marker ids are prefixed by trip because two
// trips both have a put-in, and the popup names the trip since nothing else on
// a combined map says which is which.
const points = computed<MapPoint[]>(() => {
  const all: MapPoint[] = []

  for (const trip of data.value?.trips ?? []) {
    const colour = colourOf.value.get(trip.id) ?? 0
    const belongs = { tripId: trip.id, tripTitle: trip.title, tripSlug: trip.slug, colour }
    if (trip.start_lat !== null && trip.start_lon !== null) {
      all.push({
        id: `${trip.id}-start`,
        kind: 'start',
        label: `${trip.title} — put in${trip.start_place ? `, ${trip.start_place}` : ''}`,
        lat: trip.start_lat,
        lon: trip.start_lon,
        ...belongs,
      })
    }

    const nights = (data.value?.campsites ?? []).filter(
      (site) => site.trip_id === trip.id,
    )
    nights.forEach((site, index) => {
      all.push({
        id: site.id,
        kind: 'campsite',
        label: `${trip.title} — ${site.name}`,
        sub: String(index + 1),
        lat: site.lat as number,
        lon: site.lon as number,
        ...belongs,
      })
    })

    if (trip.end_lat !== null && trip.end_lon !== null) {
      all.push({
        id: `${trip.id}-end`,
        kind: 'end',
        label: `${trip.title} — take out${trip.end_place ? `, ${trip.end_place}` : ''}`,
        lat: trip.end_lat,
        lon: trip.end_lon,
        ...belongs,
      })
    }
  }

  return all
})

// Only trips with something on the map get listed beneath it.
const plotted = computed(() =>
  (data.value?.trips ?? []).filter(
    (trip) =>
      trip.start_lat !== null ||
      trip.end_lat !== null ||
      (data.value?.campsites ?? []).some((site) => site.trip_id === trip.id),
  ),
)

function pointCount(tripId: string) {
  return points.value.filter(
    (point) => point.id === `${tripId}-start` || point.id === `${tripId}-end`,
  ).length +
    (data.value?.campsites ?? []).filter((site) => site.trip_id === tripId).length
}
</script>

<template>
  <main class="wrap">
    <div class="topbar">
      <SiteNav />
      <AccountControl />
    </div>

    <h1>Maps</h1>
    <p class="lede">Every trip that's been put on the map, all at once.</p>

    <p v-if="error" class="error">Couldn't load the map: {{ error.message }}</p>

    <p v-else-if="!points.length" class="empty">
      Nothing placed yet. Open a trip and use the pencil beside its title to set
      the put-in and take-out.
    </p>

    <template v-else>
      <ClientOnly>
        <TripMap
          :points="points"
          :picking="false"
          :focused-trip-id="focusedTripId"
        />
        <template #fallback>
          <div class="map-placeholder">Loading the map&hellip;</div>
        </template>
      </ClientOnly>

      <div class="key-head">
        <h2>Trips on this map</h2>
        <button v-if="focusedTripId" class="clear" @click="focusedTripId = null">
          Show all
        </button>
      </div>

      <!-- Picking a trip dims the others on the map rather than moving it, so
           the overview survives the selection. The swatch is the same colour
           as that trip's pins. -->
      <ul class="key">
        <li
          v-for="trip in plotted"
          :key="trip.id"
          :class="{ chosen: focusedTripId === trip.id }"
          :style="focusedTripId === trip.id ? { borderColor: swatch(trip.id) } : undefined"
        >
          <button
            class="pick"
            :class="{ picked: focusedTripId === trip.id, muted: focusedTripId && focusedTripId !== trip.id }"
            :aria-pressed="focusedTripId === trip.id"
            @click="toggleFocus(trip.id)"
          >
            <span class="dot" :style="{ background: swatch(trip.id) }" />
            <span class="name">{{ trip.title }}</span>
            <span class="count">{{ pointCount(trip.id) }} points</span>
          </button>
          <NuxtLink class="open" :to="`/trips/${trip.slug}`">Open &rarr;</NuxtLink>
        </li>
      </ul>
    </template>

    <!-- The campsite ranking lives here rather than in the nav, so it's there
         for anyone who scrolls for it without becoming the point of the site.
         Outside the v-else: campsites can be scored before anything is placed. -->
    <p class="more">
      <NuxtLink to="/campsites">All campsites, best first &rarr;</NuxtLink>
    </p>
  </main>
</template>

<style scoped>
.wrap {
  max-width: var(--page-width);
  margin: 0 auto;
  padding: 2rem;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}


h1 {
  margin: 1rem 0 0.5rem;
}

.lede {
  color: #94a3b8;
  margin: 0 0 1.5rem;
}

.empty {
  color: #94a3b8;
}

.error {
  color: #f87171;
}

.map-placeholder {
  height: clamp(16rem, 45vh, 26rem);
  border: 1px solid #334155;
  border-radius: 0.75rem;
  display: grid;
  place-items: center;
  color: #64748b;
}

.key-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.5rem 0 0.75rem;
}

.key-head h2 {
  margin: 0;
  font-size: 1rem;
  color: #94a3b8;
  font-weight: 600;
}

.clear {
  background: none;
  border: 1px solid #334155;
  color: #94a3b8;
  border-radius: 0.35rem;
  padding: 0.2rem 0.6rem;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.clear:hover {
  border-color: #38bdf8;
  color: #38bdf8;
}

.key {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 0.5rem;
}

.key li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 0.4rem 0.6rem;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

/* Bordered in the trip's own colour, so the row and its pins are obviously the
   same thing. */
.key li.chosen {
  background: #334155;
}

/* The whole row is the control, so the target is a row rather than a dot. */
.pick {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  background: none;
  border: none;
  padding: 0.15rem 0;
  font: inherit;
  color: #e2e8f0;
  text-align: left;
  cursor: pointer;
}

.pick.muted {
  opacity: 0.45;
}

.pick.picked .name {
  color: #f8fafc;
  font-weight: 600;
}

.pick.picked .dot {
  width: 0.9rem;
  height: 0.9rem;
  box-shadow: 0 0 0 0.18rem #f8fafc33;
}

.dot {
  transition:
    width 0.15s ease,
    height 0.15s ease,
    box-shadow 0.15s ease;
}

.dot {
  flex: 0 0 auto;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  border: 1px solid #0f172a;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  flex: 0 0 auto;
  color: #64748b;
  font-size: 0.8rem;
  margin-left: auto;
}

.open {
  flex: 0 0 auto;
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.8rem;
}

.open:hover {
  text-decoration: underline;
}

.more {
  margin: 2rem 0 0;
  font-size: 0.85rem;
}

.more a {
  color: #38bdf8;
  text-decoration: none;
}

.more a:hover {
  text-decoration: underline;
}
</style>
