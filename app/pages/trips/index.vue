<script setup lang="ts">
useHead({
  title: 'Trips — Kayak Trips',
})

type TripRow = {
  id: string
  slug: string
  title: string
  start_date: string
  end_date: string
  start_place: string | null
  end_place: string | null
  badge: { storage_path: string } | null
}

const supabase = useSupabaseClient()
const user = useSupabaseUser()

// Public read, so this renders server-side for anonymous visitors too.
// `photos` sits on both ends of a relationship with `trips` — `photos.trip_id`
// one way, `badge_photo_id` the other — so the embed names the constraint;
// without it PostgREST can't tell which relationship is meant.
const { data: trips, error } = await useAsyncData('trips', async () => {
  const { data, error } = await supabase
    .from('trips')
    .select(
      'id, slug, title, start_date, end_date, start_place, end_place,' +
        ' badge:photos!trips_badge_photo_fkey(storage_path)',
    )
    .order('start_date', { ascending: true })

  if (error) throw error
  return data as TripRow[]
})

function route(trip: TripRow) {
  if (!trip.start_place && !trip.end_place) return ''
  return `${trip.start_place ?? '?'} → ${trip.end_place ?? '?'}`
}

// Derived at render time, like everywhere else — rows hold paths, not URLs.
function badgeUrl(trip: TripRow) {
  if (!trip.badge) return ''
  return supabase.storage.from('photos').getPublicUrl(trip.badge.storage_path)
    .data.publicUrl
}
</script>

<template>
  <main class="wrap">
    <div class="topbar">
      <NuxtLink class="back" to="/">&larr; Back</NuxtLink>
      <div class="topbar-right">
        <NuxtLink v-if="user" class="new" to="/trips/new">New trip</NuxtLink>
        <AccountControl />
      </div>
    </div>

    <h1>Trips</h1>

    <p v-if="error" class="error">Couldn't load trips: {{ error.message }}</p>

    <p v-else-if="!trips?.length" class="empty">
      No trips yet.
      <NuxtLink v-if="user" to="/trips/new">Register the first one</NuxtLink>
      <NuxtLink v-else to="/login">Sign in to add one</NuxtLink>.
    </p>

    <ul v-else class="list">
      <li v-for="trip in trips" :key="trip.id">
        <NuxtLink :to="`/trips/${trip.slug}`">
          <img
            v-if="trip.badge"
            class="badge"
            :src="badgeUrl(trip)"
            alt=""
            loading="lazy"
          />
          <div v-else class="badge badge-empty" aria-hidden="true" />

          <div class="copy">
            <h2>{{ trip.title }}</h2>
            <p class="meta">
              {{ formatDateRange(trip.start_date, trip.end_date) }}
              &middot;
              {{ tripDayCount(trip.start_date, trip.end_date) }} days
            </p>
            <p v-if="route(trip)" class="route">{{ route(trip) }}</p>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 48rem;
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

.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.back,
.new {
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.9rem;
}

.new {
  border: 1px solid #334155;
  border-radius: 0.4rem;
  padding: 0.35rem 0.75rem;
}

.new:hover {
  border-color: #38bdf8;
}

h1 {
  margin: 1rem 0 1.5rem;
}

.empty {
  color: #94a3b8;
}

.empty a {
  color: #38bdf8;
}

.error {
  color: #f87171;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.list a {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  background: #1e293b;
  border: 1px solid transparent;
  border-radius: 0.75rem;
  padding: 1.25rem;
  text-decoration: none;
  color: inherit;
}

/* Circular, echoing the badge on the landing page — these are the same idea. */
.badge {
  flex: 0 0 auto;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  background: #0f172a;
}

.badge-empty {
  border: 1px dashed #334155;
}

.copy {
  min-width: 0;
}

.list a:hover {
  border-color: #38bdf8;
}

.list h2 {
  margin: 0;
  font-size: 1.15rem;
}

.meta {
  margin: 0.35rem 0 0;
  color: #94a3b8;
  font-size: 0.9rem;
}

.route {
  margin: 0.25rem 0 0;
  color: #64748b;
  font-size: 0.9rem;
}
</style>
