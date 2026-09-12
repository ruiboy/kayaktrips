<script setup lang="ts">
// Components are auto-imported, types are not.
import type { MapPoint } from '~/components/TripMap.vue'

type TripRow = {
  id: string
  slug: string
  title: string
  start_date: string
  end_date: string
  start_place: string | null
  end_place: string | null
  notes: string | null
  badge_photo_id: string | null
  start_lat: number | null
  start_lon: number | null
  end_lat: number | null
  end_lon: number | null
}

type PhotoRow = {
  id: string
  storage_path: string
  caption: string | null
  created_at: string
}

const route = useRoute()
const { isEditor } = useEditor()
const slug = computed(() => String(route.params.slug))

// `useRequestFetch`, not bare `$fetch`: on Workers an internal fetch starts a
// fresh event without `context.cloudflare`, so the route would find no D1
// binding and fail server-side. This one carries the current event's context
// (and its cookies) through.
const requestFetch = useRequestFetch()
const { data, error } = await useAsyncData(
  () => `trip:${slug.value}`,
  async () => {
    try {
      return await requestFetch<{ trip: TripRow; photos: PhotoRow[] }>(
        `/api/trips/${slug.value}`,
      )
    } catch (fetchError) {
      // Returned rather than rethrown on a 404: `useAsyncData` catches anything
      // the handler throws into `error`, which would render a soft failure at
      // HTTP 200. The 404 is raised outside, where it can reach the response.
      if ((fetchError as { statusCode?: number })?.statusCode === 404) return null
      throw fetchError
    }
  },
  { watch: [slug] },
)

if (!error.value && !data.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'No such trip',
    fatal: true,
  })
}

useHead(() => ({
  title: data.value ? `${data.value.trip.title} — Kayak Trips` : 'Trip — Kayak Trips',
}))

// Built at render time rather than stored, so the bucket or project can move
// without rewriting every row.
function publicUrl(path: string) {
  return photoUrl(path)
}

// Held locally so the tick moves the moment the update lands, rather than
// waiting on a refetch of the whole page.
const badgePhotoId = ref(data.value?.trip.badge_photo_id ?? null)
const badgeError = ref('')

// Found among the trip's own photos rather than fetched again, so choosing a
// new badge updates the header immediately. Nothing in the database stops a
// badge pointing at another trip's photo; the header just stays empty if it
// somehow does, which is the honest outcome.
const badgePhoto = computed(
  () => data.value?.photos.find((photo) => photo.id === badgePhotoId.value) ?? null,
)

// A native <dialog> rather than a hand-rolled overlay: Escape to dismiss and
// the focus trap come with it.
const picker = ref<HTMLDialogElement | null>(null)

function openPicker() {
  badgeError.value = ''
  picker.value?.showModal()
}

// <dialog> treats a backdrop click as a click on the dialog itself, so this
// only fires outside the panel.
function onPickerClick(event: MouseEvent) {
  if (event.target === picker.value) picker.value?.close()
}

async function setBadge(photoId: string) {
  if (!data.value) return

  picker.value?.close()
  if (photoId === badgePhotoId.value) return

  const previous = badgePhotoId.value
  badgePhotoId.value = photoId
  badgeError.value = ''

  try {
    await $fetch(`/api/trips/${data.value.trip.slug}`, {
      method: 'PATCH',
      body: { badge_photo_id: photoId },
    })
  } catch (updateError) {
    badgePhotoId.value = previous
    badgeError.value =
      (updateError as { statusMessage?: string })?.statusMessage ??
      'the change was refused. Are you still signed in?'
  }
}

// ---- Map -------------------------------------------------------------------

// Shares its fetch with TripCampsites through the keyed composable, so placing
// a campsite redraws the list and the map from the same rows.
const { data: campsites } = useCampsites(() => data.value?.trip.id ?? '')

// Held locally so a placed point appears the instant it saves.
const startPoint = ref<[number, number] | null>(
  data.value?.trip.start_lat != null && data.value?.trip.start_lon != null
    ? [data.value.trip.start_lat, data.value.trip.start_lon]
    : null,
)
const endPoint = ref<[number, number] | null>(
  data.value?.trip.end_lat != null && data.value?.trip.end_lon != null
    ? [data.value.trip.end_lat, data.value.trip.end_lon]
    : null,
)

const mapPoints = computed<MapPoint[]>(() => {
  const points: MapPoint[] = []
  const trip = data.value?.trip

  if (startPoint.value) {
    points.push({
      id: 'start',
      kind: 'start',
      label: trip?.start_place ?? 'Put-in',
      lat: startPoint.value[0],
      lon: startPoint.value[1],
    })
  }

  ;(campsites.value ?? []).forEach((site, index) => {
    if (site.lat === null || site.lon === null) return
    points.push({
      id: site.id,
      kind: 'campsite',
      label: site.name,
      // Night number, so the markers read as a sequence down the river.
      sub: String(index + 1),
      lat: site.lat,
      lon: site.lon,
    })
  })

  if (endPoint.value) {
    points.push({
      id: 'end',
      kind: 'end',
      label: trip?.end_place ?? 'Take-out',
      lat: endPoint.value[0],
      lon: endPoint.value[1],
    })
  }

  return points
})

// The put-in and take-out alone, handed to the campsite editor's map so a night
// can be placed against the ends of the trip rather than against blank river.
const endpointPoints = computed<MapPoint[]>(() =>
  mapPoints.value.filter((point) => point.kind !== 'campsite'),
)

// ---- Editing the trip ------------------------------------------------------

const editor = ref<{ show: () => void } | null>(null)

// Points and every other edited field are saved by the dialog; this folds the
// returned row back into the page so the header, the map and the dates update
// without a refetch.
function onTripSaved(row: {
  title: string
  start_date: string
  end_date: string
  start_place: string | null
  end_place: string | null
  notes: string | null
  start_lat: number | null
  start_lon: number | null
  end_lat: number | null
  end_lon: number | null
}) {
  if (!data.value) return
  Object.assign(data.value.trip, row)
  startPoint.value =
    row.start_lat != null && row.start_lon != null
      ? [row.start_lat, row.start_lon]
      : null
  endPoint.value =
    row.end_lat != null && row.end_lon != null ? [row.end_lat, row.end_lon] : null
}

// ---- Photos ----------------------------------------------------------------

const deleting = ref<string | null>(null)
const deleteError = ref('')

async function deletePhoto(photo: PhotoRow) {
  if (!data.value || deleting.value) return

  const label = photo.caption ? `“${photo.caption}”` : 'this photo'
  if (!confirm(`Delete ${label}? This can't be undone.`)) return

  deleting.value = photo.id
  deleteError.value = ''

  // Only the id goes to the server. The route reads the row to find out which
  // object to remove, so nothing here can name a file — and it still deletes
  // the row before the object, so a failure can only orphan a file rather than
  // leave a row pointing at a missing one.
  try {
    await $fetch(`/api/photos/${photo.id}`, { method: 'DELETE' })
  } catch (rowError) {
    deleting.value = null
    deleteError.value =
      (rowError as { statusCode?: number })?.statusCode === 401
        ? "That photo wasn't deleted — are you still signed in?"
        : ((rowError as { statusMessage?: string })?.statusMessage ??
          "That photo wasn't deleted.")
    return
  }

  data.value.photos = data.value.photos.filter((row) => row.id !== photo.id)
  // The FK is `on delete set null`, so the trip has already lost its badge.
  if (badgePhotoId.value === photo.id) badgePhotoId.value = null
  deleting.value = null
}
</script>

<template>
  <main class="wrap">
    <div class="topbar">
      <NuxtLink class="back" to="/trips">&larr; All trips</NuxtLink>
      <AccountControl />
    </div>

    <p v-if="error" class="error">Couldn't load this trip: {{ error.message }}</p>

    <template v-else-if="data">
      <header class="trip-head">
        <img
          v-if="badgePhoto"
          class="badge"
          :src="publicUrl(badgePhoto.storage_path)"
          :alt="badgePhoto.caption ?? ''"
        />

        <div class="trip-head-copy">
          <h1>{{ data.trip.title }}</h1>

          <p class="meta">
            {{ formatDateRange(data.trip.start_date, data.trip.end_date) }}
            &middot;
            {{ tripDayCount(data.trip.start_date, data.trip.end_date) }} days
          </p>

          <p v-if="data.trip.start_place || data.trip.end_place" class="route">
            {{ data.trip.start_place ?? '?' }} &rarr; {{ data.trip.end_place ?? '?' }}
          </p>

          <!-- A plain anchor, not a NuxtLink: the router would treat this as a
               navigation, and the browser's own hash jump is what's wanted. -->
          <div class="head-actions">
            <a v-if="isEditor || mapPoints.length" class="to-map" href="#map">
              {{ mapPoints.length ? 'See the map' : 'Place it on the map' }}
              &darr;
            </a>
            <button v-if="isEditor" class="ghost" @click="editor?.show()">
              Edit trip
            </button>
          </div>
        </div>
      </header>

      <TripEditor
        v-if="isEditor"
        ref="editor"
        :trip="data.trip"
        @saved="onTripSaved"
      />

      <p v-if="data.trip.notes" class="notes">{{ data.trip.notes }}</p>

      <div class="columns">
        <TripCampsites
          :trip-id="data.trip.id"
          :start-date="data.trip.start_date"
          :end-date="data.trip.end_date"
          :context-points="endpointPoints"
        />

        <section class="photos">
          <div class="photos-head">
            <h2>Photos</h2>
            <div v-if="isEditor" class="photo-actions">
              <button v-if="data.photos.length" class="ghost" @click="openPicker">
                Choose badge
              </button>
              <NuxtLink class="ghost" :to="`/upload?trip=${data.trip.slug}`">
                Add a photo
              </NuxtLink>
            </div>
          </div>

          <p v-if="!data.photos.length" class="empty">
            Nothing filed under this trip yet.
          </p>

          <p v-if="badgeError" class="error">
            Couldn't set the badge: {{ badgeError }}
          </p>
          <p v-if="deleteError" class="error">{{ deleteError }}</p>

          <ul v-if="data.photos.length" class="grid">
            <li v-for="photo in data.photos" :key="photo.id">
              <a :href="publicUrl(photo.storage_path)" target="_blank" rel="noopener">
                <img
                  :src="publicUrl(photo.storage_path)"
                  :alt="photo.caption ?? ''"
                  loading="lazy"
                />
              </a>
              <p v-if="photo.caption" class="caption">{{ photo.caption }}</p>

              <div class="tile-foot">
                <p v-if="photo.id === badgePhotoId" class="is-badge">★ Badge</p>
                <button
                  v-if="isEditor"
                  class="delete"
                  :disabled="deleting === photo.id"
                  @click="deletePhoto(photo)"
                >
                  {{ deleting === photo.id ? 'Deleting…' : 'Delete' }}
                </button>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <section v-if="isEditor || mapPoints.length" id="map" class="map-section">
        <div class="map-head">
          <h2>Map</h2>
        </div>

        <ClientOnly>
          <TripMap :points="mapPoints" :picking="false" />
          <template #fallback>
            <div class="map-placeholder">Loading the map&hellip;</div>
          </template>
        </ClientOnly>

        <p v-if="isEditor && !mapPoints.length" class="empty">
          Nothing placed yet. Points are set in "Edit trip" and in each
          campsite's own form.
        </p>
      </section>

      <dialog ref="picker" class="picker" @click="onPickerClick">
        <div class="picker-head">
          <h2>Choose the badge</h2>
          <button class="ghost" @click="picker?.close()">Close</button>
        </div>
        <p class="picker-lede">
          The badge is the photo that stands for this trip in the list.
        </p>

        <ul class="picker-grid">
          <li v-for="photo in data.photos" :key="photo.id">
            <button
              class="pick"
              :class="{ current: photo.id === badgePhotoId }"
              :aria-current="photo.id === badgePhotoId ? 'true' : undefined"
              @click="setBadge(photo.id)"
            >
              <img
                :src="publicUrl(photo.storage_path)"
                :alt="photo.caption ?? ''"
                loading="lazy"
              />
              <span>{{ photo.caption || 'Untitled' }}</span>
            </button>
          </li>
        </ul>
      </dialog>
    </template>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 74rem;
  margin: 0 auto;
  padding: 2rem;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.to-map {
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.9rem;
}

.to-map:hover {
  text-decoration: underline;
}

.map-section {
  margin-top: 2.5rem;
  /* So the jump doesn't land the heading flush against the top of the window. */
  scroll-margin-top: 1.5rem;
}

.map-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.map-head h2 {
  margin: 0;
  font-size: 1.1rem;
}

.map-placeholder {
  height: clamp(16rem, 45vh, 26rem);
  border: 1px solid #334155;
  border-radius: 0.75rem;
  display: grid;
  place-items: center;
  color: #64748b;
}

/* Campsites left, photos right. `auto-fit` rather than a fixed two-column
   rule, so the columns drop under each other whenever there isn't room for
   both — no breakpoint to keep in sync with the content. */
.columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(24rem, 100%), 1fr));
  align-items: start;
  gap: 2.5rem;
  margin-top: 2.5rem;
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

.trip-head {
  display: flex;
  align-items: center;
  gap: clamp(1.25rem, 4vw, 2rem);
  margin-top: 1.5rem;
}

/* Circular, matching the trips list and the badge on the landing page. */
.badge {
  flex: 0 0 auto;
  width: clamp(6rem, 18vw, 9rem);
  height: clamp(6rem, 18vw, 9rem);
  border-radius: 50%;
  object-fit: cover;
  display: block;
  background: #1e293b;
  box-shadow: 0 0.75rem 1.5rem rgb(0 0 0 / 0.35);
}

.trip-head-copy {
  min-width: 0;
}

@media (max-width: 30rem) {
  .trip-head {
    flex-direction: column;
    align-items: flex-start;
  }
}

h1 {
  margin: 0 0 0.5rem;
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

.photos {
  min-width: 0;
}

.photos-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 1rem;
}

.photos-head h2 {
  margin: 0;
  font-size: 1.1rem;
}

.photo-actions {
  display: flex;
  gap: 0.5rem;
}

.ghost {
  color: #38bdf8;
  background: none;
  text-decoration: none;
  font: inherit;
  font-size: 0.9rem;
  border: 1px solid #334155;
  border-radius: 0.4rem;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
}

.ghost:hover {
  border-color: #38bdf8;
}

.empty {
  color: #94a3b8;
}

.error {
  color: #f87171;
}

/* Smaller minimum than the full-width gallery, because this now lives in a
   column: photos wrap onto further rows within it as they pile up. */
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
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

.tile-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.4rem;
  min-height: 1.5rem;
}

.is-badge {
  margin: 0;
  font-size: 0.8rem;
  color: #38bdf8;
}

/* Quiet until you reach for it — destructive, but not the point of the page. */
.delete {
  margin-left: auto;
  background: none;
  border: 1px solid transparent;
  color: #64748b;
  border-radius: 0.35rem;
  padding: 0.15rem 0.5rem;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.delete:hover {
  border-color: #f87171;
  color: #f87171;
}

.delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.picker {
  width: min(38rem, calc(100vw - 2rem));
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.picker::backdrop {
  background: rgb(15 23 42 / 0.7);
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.picker-head h2 {
  margin: 0;
  font-size: 1.1rem;
}

.picker-lede {
  margin: 0.5rem 0 1.25rem;
  color: #94a3b8;
  font-size: 0.9rem;
}

.picker-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  gap: 1rem;
  max-height: 60vh;
  overflow-y: auto;
}

.pick {
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

/* Circular, because that's how the badge renders on the trips list — the
   preview should show the crop you're actually choosing. */
.pick img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 50%;
  display: block;
  background: #0f172a;
  border: 2px solid transparent;
}

.pick:hover img {
  border-color: #38bdf8;
}

.pick.current img {
  border-color: #38bdf8;
}

.pick span {
  font-size: 0.8rem;
  color: #94a3b8;
  text-align: center;
  overflow-wrap: anywhere;
}

.pick.current span {
  color: #38bdf8;
}
</style>
