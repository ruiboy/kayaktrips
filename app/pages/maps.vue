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
const { data, error } = await useAsyncData('all-map-points', () =>
  $fetch<{ trips: TripRow[]; campsites: CampsiteRow[] }>('/api/map'),
)

// Every trip's points on one map. Marker ids are prefixed by trip because two
// trips both have a put-in, and popups name the trip since nothing else on a
// combined map says which is which.
const points = computed<MapPoint[]>(() => {
  const all: MapPoint[] = []

  for (const trip of data.value?.trips ?? []) {
    if (trip.start_lat !== null && trip.start_lon !== null) {
      all.push({
        id: `${trip.id}-start`,
        kind: 'start',
        label: `${trip.title} — put in${trip.start_place ? `, ${trip.start_place}` : ''}`,
        lat: trip.start_lat,
        lon: trip.start_lon,
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
      })
    })

    if (trip.end_lat !== null && trip.end_lon !== null) {
      all.push({
        id: `${trip.id}-end`,
        kind: 'end',
        label: `${trip.title} — take out${trip.end_place ? `, ${trip.end_place}` : ''}`,
        lat: trip.end_lat,
        lon: trip.end_lon,
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
      <NuxtLink class="back" to="/">&larr; Back</NuxtLink>
      <AccountControl />
    </div>

    <h1>Maps</h1>
    <p class="lede">Every trip that's been put on the map, all at once.</p>

    <p v-if="error" class="error">Couldn't load the map: {{ error.message }}</p>

    <p v-else-if="!points.length" class="empty">
      Nothing placed yet. Open a trip and use "Edit trip" to set its put-in and
      take-out.
    </p>

    <template v-else>
      <ClientOnly>
        <TripMap :points="points" :picking="false" />
        <template #fallback>
          <div class="map-placeholder">Loading the map&hellip;</div>
        </template>
      </ClientOnly>

      <ul class="key">
        <li v-for="trip in plotted" :key="trip.id">
          <NuxtLink :to="`/trips/${trip.slug}`">{{ trip.title }}</NuxtLink>
          <span class="count">{{ pointCount(trip.id) }} points</span>
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 74rem;
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

.back {
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.9rem;
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

.key {
  list-style: none;
  margin: 1.25rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
}

.key li {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.key a {
  color: #38bdf8;
  text-decoration: none;
}

.key a:hover {
  text-decoration: underline;
}

.count {
  color: #64748b;
  font-size: 0.85rem;
}
</style>
