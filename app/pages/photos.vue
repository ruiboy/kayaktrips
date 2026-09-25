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

type PhotoPage = {
  photos: PhotoRow[]
  page: number
  pageCount: number
  total: number
}

const { isEditor } = useEditor()

const photoDialog = ref<{ show: (photo: PhotoRow) => void } | null>(null)

// The full-size viewer. Reads the same list the grid renders, so forward and
// back walk the photos in the order they are on screen.
const lightbox = ref<{ show: (id: string) => void } | null>(null)

// Folded back in rather than refetched, so the tile changes the moment the
// dialog closes.
function onSaved(saved: { id: string; caption: string | null }) {
  const row = data.value?.photos.find((photo) => photo.id === saved.id)
  if (row) row.caption = saved.caption
}

function onDeleted(id: string) {
  if (!data.value) return
  data.value.photos = data.value.photos.filter((photo) => photo.id !== id)
  data.value.total -= 1
}

// Public read, so this renders server-side for anonymous visitors too. The
// route does the join that used to be a PostgREST embed naming its FK.
// `useRequestFetch`, not bare `$fetch`: on Workers an internal fetch starts a
// fresh event without `context.cloudflare`, so the route would find no D1
// binding and fail server-side. This one carries the current event's context
// (and its cookies) through.
const requestFetch = useRequestFetch()

// The page lives in the URL rather than in a ref, so a page of the gallery can
// be linked, bookmarked and reached with the back button — and so the fetch
// that SSR does is the one the URL asked for.
const route = useRoute()
const page = computed(() => {
  const asked = Number.parseInt(String(route.query.page ?? '1'), 10)
  return Number.isFinite(asked) && asked > 0 ? asked : 1
})

const { data, error } = await useAsyncData(
  () => `photos:${page.value}`,
  () => requestFetch<PhotoPage>('/api/photos', { query: { page: page.value } }),
  { watch: [page] },
)

// The route clamps an out-of-range page, so this is the page actually served
// rather than the one asked for.
const photos = computed(() => data.value?.photos ?? [])
const pageCount = computed(() => data.value?.pageCount ?? 1)
const shown = computed(() => data.value?.page ?? 1)

// Nuxt scrolls to the top when the path changes, but paging only changes the
// query, so the reader stayed where the Next button had left them — at the
// bottom, looking at the last row of a page they had just left. Instantly
// rather than smoothly: the grid underneath has been replaced, so there is no
// continuity for a glide to preserve.
watch(page, () => {
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'instant' })
})

// Page one is the bare path: a gallery's first page shouldn't need a query
// string to be its own address.
function pageLink(n: number) {
  return n === 1 ? '/photos' : `/photos?page=${n}`
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
    <div class="topbar">
      <SiteNav />
      <div class="topbar-right">
        <NuxtLink v-if="isEditor" class="add" to="/upload">Add a photo</NuxtLink>
        <AccountControl />
      </div>
    </div>

    <h1>Photos</h1>

    <p v-if="error" class="error">Couldn't load photos: {{ error.message }}</p>

    <p v-else-if="!photos.length" class="empty">
      No photos yet. <NuxtLink to="/upload">Upload the first one</NuxtLink>.
    </p>

    <ul v-else class="grid">
      <li v-for="photo in photos" :key="photo.id">
        <!-- Still a real link to the original, so middle-click and "open in
             new tab" keep working and it degrades without JS. The click itself
             opens the lightbox instead. -->
        <a
          :href="photoUrl(photo.storage_path)"
          @click.prevent="lightbox?.show(photo.id)"
        >
          <img
            :src="thumbUrl(photo.storage_path)"
            :alt="photo.caption ?? ''"
            loading="lazy"
          />
        </a>
        <!-- Same shape as the trip page: the pencil runs on from the caption
             text so it keeps to the last line of a wrapped one. An unfiled
             photo has no trip page, so this is the only place it can be
             edited at all. -->
        <p v-if="photo.caption || isEditor" class="caption">
          {{ photo.caption }}
          <EditButton
            v-if="isEditor"
            class="inline-edit"
            :label="`Edit ${photo.caption || 'this photo'}`"
            @click="photoDialog?.show(photo)"
          />
        </p>

        <NuxtLink v-if="photo.trip" class="trip" :to="`/trips/${photo.trip.slug}`">
          {{ photo.trip.title }}
        </NuxtLink>
        <span v-else class="unfiled">Not filed under a trip</span>

        <time :datetime="photo.created_at">{{ formatDate(photo.created_at) }}</time>
      </li>
    </ul>

    <!-- Two links and where you are. Kept under the grid rather than over it:
         at the top it would be the first thing on a page whose point is the
         photos, and you only want it once you've run out of them. A link
         rather than a button, so a page of the gallery has an address. -->
    <nav v-if="pageCount > 1" class="paging">
      <NuxtLink v-if="shown > 1" class="step" :to="pageLink(shown - 1)" rel="prev">
        ‹ Previous
      </NuxtLink>
      <span v-else class="step disabled" aria-hidden="true">‹ Previous</span>

      <span class="where">Page {{ shown }} of {{ pageCount }}</span>

      <NuxtLink
        v-if="shown < pageCount"
        class="step"
        :to="pageLink(shown + 1)"
        rel="next"
      >
        Next ›
      </NuxtLink>
      <span v-else class="step disabled" aria-hidden="true">Next ›</span>
    </nav>

    <!-- The set it walks is this page of the gallery, so forward and back
         mean the next photo on screen rather than the next in the database. -->
    <PhotoLightbox v-if="photos.length" ref="lightbox" :photos="photos" />

    <PhotoDialog
      v-if="isEditor"
      ref="photoDialog"
      @saved="onSaved"
      @deleted="onDeleted"
    />
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

.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
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

/* Sits in the text flow, so it trails the last word of a wrapped caption
   rather than needing a column of its own. */
.inline-edit {
  vertical-align: -0.35em;
  margin-left: 0.15rem;
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

.paging {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
}

.step {
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.9rem;
  border: 1px solid #334155;
  border-radius: 0.4rem;
  padding: 0.35rem 0.75rem;
}

.step:hover {
  border-color: #38bdf8;
}

/* Held in place rather than removed, so the two ends of the row don't swap
   sides between the first page and the last. */
.step.disabled {
  color: #475569;
  border-color: #1e293b;
}

.where {
  color: #94a3b8;
  font-size: 0.85rem;
}

.grid time {
  display: block;
  margin-top: 0.25rem;
  color: #64748b;
  font-size: 0.8rem;
}
</style>
