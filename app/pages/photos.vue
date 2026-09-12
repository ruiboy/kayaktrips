<script setup lang="ts">
useHead({
  title: 'Photos — Kayak Trips',
})

type PhotoRow = {
  id: string
  storage_path: string
  caption: string | null
  created_at: string
  trip: { slug: string; title: string } | null
}

const { isEditor } = useEditor()

// Public read, so this renders server-side for anonymous visitors too. The
// route does the join that used to be a PostgREST embed naming its FK.
// `useRequestFetch`, not bare `$fetch`: on Workers an internal fetch starts a
// fresh event without `context.cloudflare`, so the route would find no D1
// binding and fail server-side. This one carries the current event's context
// (and its cookies) through.
const requestFetch = useRequestFetch()
const { data: photos, error } = await useAsyncData('photos', () =>
  requestFetch<PhotoRow[]>('/api/photos'),
)

const dateFormat = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatDate(iso: string) {
  return dateFormat.format(new Date(iso))
}
</script>

<template>
  <main class="wrap">
    <div class="topbar">
      <NuxtLink class="back" to="/">&larr; Back</NuxtLink>
      <div class="topbar-right">
        <NuxtLink v-if="isEditor" class="add" to="/upload">Add a photo</NuxtLink>
        <AccountControl />
      </div>
    </div>

    <h1>Photos</h1>

    <p v-if="error" class="error">Couldn't load photos: {{ error.message }}</p>

    <p v-else-if="!photos?.length" class="empty">
      No photos yet. <NuxtLink to="/upload">Upload the first one</NuxtLink>.
    </p>

    <ul v-else class="grid">
      <li v-for="photo in photos" :key="photo.id">
        <a :href="photoUrl(photo.storage_path)" target="_blank" rel="noopener">
          <img
            :src="photoUrl(photo.storage_path)"
            :alt="photo.caption ?? ''"
            loading="lazy"
          />
        </a>
        <p v-if="photo.caption" class="caption">{{ photo.caption }}</p>

        <NuxtLink v-if="photo.trip" class="trip" :to="`/trips/${photo.trip.slug}`">
          {{ photo.trip.title }}
        </NuxtLink>
        <span v-else class="unfiled">Not filed under a trip</span>

        <time :datetime="photo.created_at">{{ formatDate(photo.created_at) }}</time>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 60rem;
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

.back {
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.9rem;
}

.add {
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.8rem;
  border: 1px solid #334155;
  border-radius: 0.35rem;
  padding: 0.25rem 0.6rem;
}

.add:hover {
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

.trip {
  display: block;
  margin-top: 0.35rem;
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.85rem;
}

.trip:hover {
  text-decoration: underline;
}

/* Photos uploaded before trips existed, and any uploaded without picking one.
   `photos` has no update policy, so they can only be filed by re-uploading. */
.unfiled {
  display: block;
  margin-top: 0.35rem;
  color: #64748b;
  font-size: 0.85rem;
  font-style: italic;
}

.grid time {
  display: block;
  margin-top: 0.25rem;
  color: #64748b;
  font-size: 0.8rem;
}
</style>
