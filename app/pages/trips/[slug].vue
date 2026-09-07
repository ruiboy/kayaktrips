<script setup lang="ts">
type TripRow = {
  id: string
  slug: string
  title: string
  start_date: string
  end_date: string
  start_place: string | null
  end_place: string | null
  notes: string | null
}

type PhotoRow = {
  id: string
  storage_path: string
  caption: string | null
  created_at: string
}

const route = useRoute()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const slug = computed(() => String(route.params.slug))

const { data, error } = await useAsyncData(
  () => `trip:${slug.value}`,
  async () => {
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select(
        'id, slug, title, start_date, end_date, start_place, end_place, notes',
      )
      .eq('slug', slug.value)
      .maybeSingle()

    if (tripError) throw tripError
    if (!trip) throw createError({ statusCode: 404, statusMessage: 'No such trip' })

    // Filed photos only. Anything uploaded before trips existed has a null
    // trip_id and lives in the general gallery until it's uploaded again.
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('id, storage_path, caption, created_at')
      .eq('trip_id', (trip as TripRow).id)
      .order('created_at', { ascending: true })

    if (photosError) throw photosError

    return { trip: trip as TripRow, photos: photos as PhotoRow[] }
  },
  { watch: [slug] },
)

useHead(() => ({
  title: data.value ? `${data.value.trip.title} — Kayak Trips` : 'Trip — Kayak Trips',
}))

// Built at render time rather than stored, so the bucket or project can move
// without rewriting every row.
function publicUrl(path: string) {
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
}
</script>

<template>
  <main class="wrap">
    <NuxtLink class="back" to="/trips">&larr; All trips</NuxtLink>

    <p v-if="error" class="error">Couldn't load this trip: {{ error.message }}</p>

    <template v-else-if="data">
      <h1>{{ data.trip.title }}</h1>

      <p class="meta">
        {{ formatDateRange(data.trip.start_date, data.trip.end_date) }}
        &middot;
        {{ tripDayCount(data.trip.start_date, data.trip.end_date) }} days
      </p>

      <p v-if="data.trip.start_place || data.trip.end_place" class="route">
        {{ data.trip.start_place ?? '?' }} &rarr; {{ data.trip.end_place ?? '?' }}
      </p>

      <p v-if="data.trip.notes" class="notes">{{ data.trip.notes }}</p>

      <div class="photos-head">
        <h2>Photos</h2>
        <NuxtLink v-if="user" class="add" :to="`/upload?trip=${data.trip.slug}`">
          Add a photo
        </NuxtLink>
      </div>

      <p v-if="!data.photos.length" class="empty">
        Nothing filed under this trip yet.
      </p>

      <ul v-else class="grid">
        <li v-for="photo in data.photos" :key="photo.id">
          <a :href="publicUrl(photo.storage_path)" target="_blank" rel="noopener">
            <img
              :src="publicUrl(photo.storage_path)"
              :alt="photo.caption ?? ''"
              loading="lazy"
            />
          </a>
          <p v-if="photo.caption" class="caption">{{ photo.caption }}</p>
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 60rem;
  margin: 0 auto;
  padding: 2rem;
}

.back {
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.9rem;
}

h1 {
  margin: 1rem 0 0.5rem;
}

.meta {
  margin: 0;
  color: #94a3b8;
}

.route {
  margin: 0.35rem 0 0;
  color: #64748b;
}

.notes {
  margin: 1rem 0 0;
  max-width: 40rem;
  line-height: 1.6;
  white-space: pre-wrap;
}

.photos-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 2.5rem 0 1rem;
}

.photos-head h2 {
  margin: 0;
  font-size: 1.1rem;
}

.add {
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.9rem;
  border: 1px solid #334155;
  border-radius: 0.4rem;
  padding: 0.35rem 0.75rem;
}

.add:hover {
  border-color: #38bdf8;
}

.empty {
  color: #94a3b8;
}

.error {
  color: #f87171;
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: 1.25rem;
}

.grid img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 0.5rem;
  display: block;
  background: #1e293b;
}

.caption {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
  line-height: 1.4;
}
</style>
