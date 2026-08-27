<script setup lang="ts">
useHead({
  title: 'Photos — Kayak Trips',
})

type PhotoRow = {
  id: string
  storage_path: string
  caption: string | null
  created_at: string
}

const supabase = useSupabaseClient()

// Public read, so this renders server-side for anonymous visitors too.
const { data: photos, error } = await useAsyncData('photos', async () => {
  const { data, error } = await supabase
    .from('photos')
    .select('id, storage_path, caption, created_at')
    .order('created_at', { ascending: false })
    .limit(60)

  if (error) throw error
  return data as PhotoRow[]
})

// Built at render time rather than stored, so the bucket or project can move
// without rewriting every row.
function publicUrl(path: string) {
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
}

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
    <NuxtLink class="back" to="/">&larr; Back</NuxtLink>
    <h1>Photos</h1>

    <p v-if="error" class="error">Couldn't load photos: {{ error.message }}</p>

    <p v-else-if="!photos?.length" class="empty">
      No photos yet. <NuxtLink to="/upload">Upload the first one</NuxtLink>.
    </p>

    <ul v-else class="grid">
      <li v-for="photo in photos" :key="photo.id">
        <a :href="publicUrl(photo.storage_path)" target="_blank" rel="noopener">
          <img
            :src="publicUrl(photo.storage_path)"
            :alt="photo.caption ?? ''"
            loading="lazy"
          />
        </a>
        <p v-if="photo.caption" class="caption">{{ photo.caption }}</p>
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

.back {
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.9rem;
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

.grid time {
  display: block;
  margin-top: 0.25rem;
  color: #64748b;
  font-size: 0.8rem;
}
</style>
