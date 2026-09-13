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

// Everything on this page draws small — the hero badge, the photo grid, the
// badge strip. Only the click-through wants the original.
function thumb(path: string) {
  return thumbUrl(path)
}

// Held locally so the tick moves the moment the update lands, rather than
// waiting on a refetch of the whole page.
const badgePhotoId = ref(data.value?.trip.badge_photo_id ?? null)

// Found among the trip's own photos rather than fetched again, so choosing a
// new badge updates the header immediately. Nothing in the database stops a
// badge pointing at another trip's photo; the header just stays empty if it
// somehow does, which is the honest outcome.
const badgePhoto = computed(
  () => data.value?.photos.find((photo) => photo.id === badgePhotoId.value) ?? null,
)

// The per-photo dialog. Opened by the pencil on a tile; holds the badge
// control and Delete, so neither sits on the page where a reader's thumb is.
const photoDialog = ref<{ show: (photo: PhotoRow) => void } | null>(null)

// Folded back in rather than refetched, so the tile and the header follow the
// dialog closing.
function onPhotoSaved(saved: { id: string; caption: string | null }) {
  const row = data.value?.photos.find((photo) => photo.id === saved.id)
  if (row) row.caption = saved.caption
}

function onPhotoDeleted(id: string) {
  if (!data.value) return
  data.value.photos = data.value.photos.filter((photo) => photo.id !== id)
  // The FK is `on delete set null`, so the trip has already lost its badge.
  if (badgePhotoId.value === id) badgePhotoId.value = null
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
  badge_photo_id: string | null
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
  // The badge is edited with the trip now, so the header follows the save.
  badgePhotoId.value = row.badge_photo_id
  startPoint.value =
    row.start_lat != null && row.start_lon != null
      ? [row.start_lat, row.start_lon]
      : null
  endPoint.value =
    row.end_lat != null && row.end_lon != null ? [row.end_lat, row.end_lon] : null
}

</script>

<template>
  <main class="wrap">
    <div class="topbar">
      <SiteNav />
      <AccountControl />
    </div>

    <p v-if="error" class="error">Couldn't load this trip: {{ error.message }}</p>

    <template v-else-if="data">
      <header class="trip-head">
        <img
          v-if="badgePhoto"
          class="badge"
          :src="thumb(badgePhoto.storage_path)"
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
            <EditButton
              v-if="isEditor"
              :label="`Edit ${data.trip.title}`"
              @click="editor?.show()"
            />
          </div>
        </div>
      </header>

      <TripEditor
        v-if="isEditor"
        ref="editor"
        :trip="data.trip"
        :photos="data.photos"
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
              <NuxtLink class="ghost" :to="`/upload?trip=${data.trip.slug}`">
                Add a photo
              </NuxtLink>
            </div>
          </div>

          <p v-if="!data.photos.length" class="empty">
            Nothing filed under this trip yet.
          </p>


          <ul v-if="data.photos.length" class="grid">
            <li v-for="photo in data.photos" :key="photo.id">
              <a :href="publicUrl(photo.storage_path)" target="_blank" rel="noopener">
                <img
                  :src="thumb(photo.storage_path)"
                  :alt="photo.caption ?? ''"
                  loading="lazy"
                />
              </a>

              <!-- The pencil runs on from the caption text rather than sitting
                   in a column of its own. Inline, so on a caption that wraps it
                   follows the last word instead of hanging level with the first
                   line and leaving a row of pencils at different heights. -->
              <p v-if="photo.caption || isEditor" class="caption">
                <span v-if="photo.id === badgePhotoId" class="is-badge" title="Trip badge">★</span>
                {{ photo.caption }}
                <EditButton
                  v-if="isEditor"
                  class="inline-edit"
                  :label="`Edit ${photo.caption || 'this photo'}`"
                  @click="photoDialog?.show(photo)"
                />
              </p>
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
          Nothing placed yet. Points are set by the pencil beside the trip's
          title, and in each campsite's own form.
        </p>
      </section>

      <PhotoDialog
        v-if="isEditor"
        ref="photoDialog"
        @saved="onPhotoSaved"
        @deleted="onPhotoDeleted"
      />

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

/* Sits in the text flow, so it trails the last word of a wrapped caption and
   needs no reserved column. The photo stays uncluttered. */
.inline-edit {
  vertical-align: -0.35em;
  margin-left: 0.15rem;
}

.caption {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
  line-height: 1.4;
  min-width: 0;
}

.is-badge {
  color: #38bdf8;
  margin-right: 0.15rem;
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

/* Small and centred: it holds two actions, not a form. */
</style>
