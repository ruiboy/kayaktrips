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
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const slug = computed(() => String(route.params.slug))

const { data, error } = await useAsyncData(
  () => `trip:${slug.value}`,
  async () => {
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select(
        'id, slug, title, start_date, end_date, start_place, end_place, notes,' +
          ' badge_photo_id, start_lat, start_lon, end_lat, end_lon',
      )
      .eq('slug', slug.value)
      .maybeSingle()

    if (tripError) throw tripError
    // Returned rather than thrown: `useAsyncData` catches anything the handler
    // throws into `error`, which would render a soft failure at HTTP 200. The
    // 404 is raised outside, where it can reach the response.
    if (!trip) return null

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
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
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

  // `.select()` for the same reason as the delete below: an update RLS won't
  // allow matches no rows rather than erroring, so without the returned row a
  // refusal is indistinguishable from success.
  const { data: updated, error: updateError } = await supabase
    .from('trips')
    .update({ badge_photo_id: photoId })
    .eq('id', data.value.trip.id)
    .select('id')

  if (updateError || !updated?.length) {
    badgePhotoId.value = previous
    badgeError.value =
      updateError?.message ?? 'the database refused the change. Are you still signed in?'
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

// null when not picking; otherwise what the next map click sets.
const picking = ref<{ kind: 'start' | 'end' } | { kind: 'campsite'; id: string } | null>(
  null,
)
const mapError = ref('')

const pickingLabel = computed(() => {
  if (!picking.value) return ''
  if (picking.value.kind === 'start') return 'the put-in'
  if (picking.value.kind === 'end') return 'the take-out'
  const site = (campsites.value ?? []).find((row) => row.id === picking.value?.id)
  return site ? site.name : 'the campsite'
})

function arm(target: NonNullable<typeof picking.value>) {
  mapError.value = ''
  // Clicking the same button again disarms, so there's a way out that isn't
  // placing a point you didn't want.
  picking.value =
    picking.value &&
    picking.value.kind === target.kind &&
    (target.kind !== 'campsite' ||
      ('id' in picking.value && picking.value.id === target.id))
      ? null
      : target
}

async function place({ lat, lon }: { lat: number; lon: number }) {
  const target = picking.value
  const trip = data.value?.trip
  if (!target || !trip) return

  // Six decimals is about 10cm — well past what clicking a map can express,
  // and it keeps the stored numbers readable.
  const round = (value: number) => Number(value.toFixed(6))
  const point: [number, number] = [round(lat), round(lon)]
  picking.value = null
  mapError.value = ''

  if (target.kind === 'campsite') {
    const { data: updated, error: updateError } = await supabase
      .from('campsites')
      .update({ lat: point[0], lon: point[1] })
      .eq('id', target.id)
      .select('id')

    if (updateError || !updated?.length) {
      mapError.value = updateError?.message ?? 'The database refused that.'
      return
    }

    const site = (campsites.value ?? []).find((row) => row.id === target.id)
    if (site) {
      site.lat = point[0]
      site.lon = point[1]
    }
    return
  }

  const fields =
    target.kind === 'start'
      ? { start_lat: point[0], start_lon: point[1] }
      : { end_lat: point[0], end_lon: point[1] }

  const { data: updated, error: updateError } = await supabase
    .from('trips')
    .update(fields)
    .eq('id', trip.id)
    .select('id')

  if (updateError || !updated?.length) {
    mapError.value = updateError?.message ?? 'The database refused that.'
    return
  }

  if (target.kind === 'start') startPoint.value = point
  else endPoint.value = point
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

  // Row first, file second. The other order can leave a row pointing at a file
  // that no longer exists — a broken tile in the gallery. This order can leave
  // an orphaned file, which nothing lists and nothing renders.
  //
  // `.select()` matters: RLS doesn't refuse a delete, it just matches no rows,
  // so a blocked delete returns 204 with no error and looks identical to a
  // successful one. The returned rows are the only evidence anything happened.
  const { data: removed, error: rowError } = await supabase
    .from('photos')
    .delete()
    .eq('id', photo.id)
    .select('id')

  if (rowError) {
    deleting.value = null
    deleteError.value = rowError.message
    return
  }

  if (!removed?.length) {
    deleting.value = null
    deleteError.value =
      "That photo wasn't deleted — the database refused it. There's no delete policy on `photos` for your account."
    return
  }

  const { error: fileError } = await supabase.storage
    .from('photos')
    .remove([photo.storage_path])

  data.value.photos = data.value.photos.filter((row) => row.id !== photo.id)
  // The FK is `on delete set null`, so the trip has already lost its badge.
  if (badgePhotoId.value === photo.id) badgePhotoId.value = null
  deleting.value = null

  if (fileError) {
    deleteError.value = `Removed from the gallery, but the file is still in the bucket: ${fileError.message}`
  }
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
          <a v-if="user || mapPoints.length" class="to-map" href="#map">
            {{ mapPoints.length ? 'See the map' : 'Place it on the map' }}
            &darr;
          </a>
        </div>
      </header>

      <p v-if="data.trip.notes" class="notes">{{ data.trip.notes }}</p>

      <div class="columns">
        <TripCampsites
          :trip-id="data.trip.id"
          :start-date="data.trip.start_date"
          :end-date="data.trip.end_date"
          :picking-id="picking?.kind === 'campsite' ? picking.id : null"
          @pick="(id: string) => arm({ kind: 'campsite', id })"
        />

        <section class="photos">
          <div class="photos-head">
            <h2>Photos</h2>
            <div v-if="user" class="photo-actions">
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
                  v-if="user"
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

      <section v-if="user || mapPoints.length" id="map" class="map-section">
        <div class="map-head">
          <h2>Map</h2>
          <div v-if="user" class="map-actions">
            <button
              class="ghost"
              :class="{ armed: picking?.kind === 'start' }"
              @click="arm({ kind: 'start' })"
            >
              {{ startPoint ? 'Move put-in' : 'Set put-in' }}
            </button>
            <button
              class="ghost"
              :class="{ armed: picking?.kind === 'end' }"
              @click="arm({ kind: 'end' })"
            >
              {{ endPoint ? 'Move take-out' : 'Set take-out' }}
            </button>
          </div>
        </div>

        <p v-if="picking" class="picking-note">
          Placing {{ pickingLabel }} &mdash; click the map, or press the button
          again to cancel.
        </p>
        <p v-if="mapError" class="error">Couldn't save that point: {{ mapError }}</p>

        <ClientOnly>
          <TripMap
            :points="mapPoints"
            :picking="Boolean(picking)"
            @place="place"
          />
          <template #fallback>
            <div class="map-placeholder">Loading the map&hellip;</div>
          </template>
        </ClientOnly>

        <p v-if="user && !mapPoints.length" class="empty">
          Nothing placed yet. Use the buttons above, and "Set location" on a
          campsite.
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

.to-map {
  display: inline-block;
  margin-top: 0.75rem;
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

.map-actions {
  display: flex;
  gap: 0.5rem;
}

.ghost.armed {
  border-color: #38bdf8;
  background: #38bdf8;
  color: #0f172a;
}

.picking-note {
  margin: 0 0 0.75rem;
  color: #38bdf8;
  font-size: 0.9rem;
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
