<script setup lang="ts">
import type { MapPoint } from '~/components/TripMap.vue'

export type TripPhoto = {
  id: string
  storage_path: string
  caption: string | null
}

export type EditableTrip = {
  id: string
  // The trip is addressed by slug in the API, so the editor needs it even
  // though nothing here can change it.
  slug: string
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
}

const props = defineProps<{
  trip: EditableTrip
  // The trip's own photos, to pick a badge from. The picker doesn't render
  // when a trip has none.
  photos: TripPhoto[]
}>()
const emit = defineEmits<{ saved: [EditableTrip] }>()


const dialog = ref<HTMLDialogElement | null>(null)

// Deleting a trip is the one act here that takes other rows with it, so it
// hides until asked for and then wants the title typed. Campsites cascade;
// photos survive with a null trip_id, which is what the copy says.
const armDelete = ref(false)
const deleteConfirm = ref('')
const deleteError = ref('')
const deleting = ref(false)

async function removeTrip() {
  if (deleteConfirm.value.trim() !== props.trip.title || deleting.value) return

  deleting.value = true
  deleteError.value = ''

  try {
    await $fetch(`/api/trips/${props.trip.slug}`, { method: 'DELETE' })
  } catch (error) {
    deleting.value = false
    deleteError.value =
      (error as { statusCode?: number })?.statusCode === 401
        ? 'That was refused. Are you still signed in?'
        : ((error as { statusMessage?: string })?.statusMessage ??
          'That trip was not deleted.')
    return
  }

  // The page this dialog sits on is about to stop existing, so leave rather
  // than close and re-render a trip that has gone.
  await navigateTo('/trips')
}
const saving = ref(false)
const formError = ref('')

const draft = reactive({
  title: '',
  start_date: '',
  end_date: '',
  start_place: '',
  end_place: '',
  notes: '',
  start_lat: '',
  start_lon: '',
  end_lat: '',
  end_lon: '',
  badge_photo_id: null as string | null,
})

const asText = (value: number | null) => (value === null ? '' : String(value))

function show() {
  formError.value = ''
  target.value = 'start'
  Object.assign(draft, {
    badge_photo_id: props.trip.badge_photo_id,
    title: props.trip.title,
    start_date: props.trip.start_date,
    end_date: props.trip.end_date,
    start_place: props.trip.start_place ?? '',
    end_place: props.trip.end_place ?? '',
    notes: props.trip.notes ?? '',
    start_lat: asText(props.trip.start_lat),
    start_lon: asText(props.trip.start_lon),
    end_lat: asText(props.trip.end_lat),
    end_lon: asText(props.trip.end_lon),
  })
  dialog.value?.showModal()
}

function close() {
  dialog.value?.close()
}

function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

defineExpose({ show })

// ---- Coordinates -----------------------------------------------------------

// Which point a map click sets. Two markers, one map: you place the take-out
// while looking at where the put-in is.
const target = ref<'start' | 'end'>('start')

function numberOrNull(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const draftPoints = computed<MapPoint[]>(() => {
  const points: MapPoint[] = []
  const startLat = numberOrNull(draft.start_lat)
  const startLon = numberOrNull(draft.start_lon)
  const endLat = numberOrNull(draft.end_lat)
  const endLon = numberOrNull(draft.end_lon)

  if (startLat !== null && startLon !== null) {
    points.push({
      id: 'start',
      kind: 'start',
      label: draft.start_place || 'Put-in',
      lat: startLat,
      lon: startLon,
    })
  }
  if (endLat !== null && endLon !== null) {
    points.push({
      id: 'end',
      kind: 'end',
      label: draft.end_place || 'Take-out',
      lat: endLat,
      lon: endLon,
    })
  }
  return points
})

function onPlace({ lat, lon }: { lat: number; lon: number }) {
  // Six decimals is about 10cm, well past what a click can express.
  const round = (value: number) => String(Number(value.toFixed(6)))
  if (target.value === 'start') {
    draft.start_lat = round(lat)
    draft.start_lon = round(lon)
  } else {
    draft.end_lat = round(lat)
    draft.end_lon = round(lon)
  }
}

function clearTarget(which: 'start' | 'end') {
  if (which === 'start') {
    draft.start_lat = ''
    draft.start_lon = ''
  } else {
    draft.end_lat = ''
    draft.end_lon = ''
  }
}

const mapPicker = ref<{ show: () => void } | null>(null)

function pick(which: 'start' | 'end') {
  target.value = which
  mapPicker.value?.show()
}

// The form shows the coordinates as text rather than as inputs: the map is the
// way in now, and a pair of decimal fields on a form you rarely retype was
// mostly noise.
function describe(which: 'start' | 'end') {
  const lat = which === 'start' ? draft.start_lat : draft.end_lat
  const lon = which === 'start' ? draft.start_lon : draft.end_lon
  return lat && lon ? `${lat}, ${lon}` : 'Not placed'
}

const datesBackwards = computed(
  () => Boolean(draft.start_date && draft.end_date && draft.end_date < draft.start_date),
)

const dayCount = computed(() => {
  if (!draft.start_date || !draft.end_date || datesBackwards.value) return null
  return tripDayCount(draft.start_date, draft.end_date)
})

async function save() {
  if (!draft.title.trim() || !draft.start_date || !draft.end_date) return
  if (datesBackwards.value || saving.value) return

  saving.value = true
  formError.value = ''

  // The slug deliberately isn't recomputed from the title: it's the trip's
  // URL, and silently moving it would break every link already shared.
  const fields = {
    title: draft.title.trim(),
    start_date: draft.start_date,
    end_date: draft.end_date,
    start_place: draft.start_place.trim() || null,
    end_place: draft.end_place.trim() || null,
    notes: draft.notes.trim() || null,
    start_lat: numberOrNull(draft.start_lat),
    start_lon: numberOrNull(draft.start_lon),
    end_lat: numberOrNull(draft.end_lat),
    end_lon: numberOrNull(draft.end_lon),
    // Chosen here rather than from the page: the badge is a property of the
    // trip, so it saves with the rest of it instead of writing through on click.
    badge_photo_id: draft.badge_photo_id,
  }

  // The route returns the saved row, which is still the only proof the write
  // happened — and a 401 from it is the new shape of "you are not signed in".
  let row: EditableTrip | null = null
  try {
    row = await $fetch<EditableTrip>(`/api/trips/${props.trip.slug}`, {
      method: 'PATCH',
      body: fields,
    })
  } catch (error) {
    saving.value = false
    formError.value =
      (error as { statusCode?: number })?.statusCode === 401
        ? 'That was refused. Are you still signed in?'
        : ((error as { statusMessage?: string })?.statusMessage ?? 'That did not save.')
    return
  }

  saving.value = false

  if (!row) {
    formError.value = 'That was refused. Are you still signed in?'
    return
  }

  emit('saved', row)
  close()
}
</script>

<template>
  <dialog ref="dialog" class="editor" @click="onDialogClick">
    <form @submit.prevent="save">
      <div class="editor-head">
        <h2>Edit trip</h2>
        <button type="button" class="ghost" @click="close">Close</button>
      </div>

      <label>
        <span>Title</span>
        <input v-model="draft.title" type="text" maxlength="120" required />
      </label>

      <div class="pair">
        <label>
          <span>Put in</span>
          <input v-model="draft.start_date" type="date" required />
        </label>
        <label>
          <span>Take out</span>
          <input v-model="draft.end_date" type="date" required />
        </label>
      </div>

      <p v-if="datesBackwards" class="error">The take-out is before the put-in.</p>
      <p v-else-if="dayCount" class="derived">
        {{ dayCount }} {{ dayCount === 1 ? 'day' : 'days' }} on the water.
      </p>

      <div class="pair">
        <label>
          <span>From</span>
          <input v-model="draft.start_place" type="text" maxlength="120" />
        </label>
        <label>
          <span>To</span>
          <input v-model="draft.end_place" type="text" maxlength="120" />
        </label>
      </div>

      <label>
        <span>Notes</span>
        <textarea v-model="draft.notes" rows="3" maxlength="2000" />
      </label>

      <fieldset class="points">
        <legend>Where on the map</legend>

        <div class="point-row">
          <span class="point-label">Put-in</span>
          <span class="point-value">{{ describe('start') }}</span>
          <button type="button" class="ghost small" @click="pick('start')">
            {{ draft.start_lat ? 'Move' : 'Set' }} on map
          </button>
          <button
            v-if="draft.start_lat"
            type="button"
            class="ghost small"
            @click="clearTarget('start')"
          >
            Clear
          </button>
        </div>

        <div class="point-row">
          <span class="point-label">Take-out</span>
          <span class="point-value">{{ describe('end') }}</span>
          <button type="button" class="ghost small" @click="pick('end')">
            {{ draft.end_lat ? 'Move' : 'Set' }} on map
          </button>
          <button
            v-if="draft.end_lat"
            type="button"
            class="ghost small"
            @click="clearTarget('end')"
          >
            Clear
          </button>
        </div>
      </fieldset>

      <fieldset v-if="photos.length" class="badge-field">
        <legend>Badge</legend>
        <p class="hint">The photo that stands for this trip in the list.</p>

        <ul class="badge-strip">
          <li v-for="photo in photos" :key="photo.id">
            <button
              type="button"
              class="badge-pick"
              :class="{ current: draft.badge_photo_id === photo.id }"
              :aria-pressed="draft.badge_photo_id === photo.id"
              :title="photo.caption ?? 'Untitled'"
              @click="
                draft.badge_photo_id =
                  draft.badge_photo_id === photo.id ? null : photo.id
              "
            >
              <img
                :src="thumbUrl(photo.storage_path)"
                :alt="photo.caption ?? ''"
                loading="lazy"
              />
            </button>
          </li>
        </ul>
      </fieldset>

      <MapPickerDialog
        ref="mapPicker"
        :points="draftPoints"
        :title="target === 'start' ? 'Place the put-in' : 'Place the take-out'"
        @place="onPlace"
      />

      <p v-if="formError" class="error">{{ formError }}</p>

      <div class="form-foot">
        <button type="button" class="danger-link" @click="armDelete = !armDelete">
          {{ armDelete ? 'Never mind' : 'Delete this trip' }}
        </button>

        <button type="submit" class="primary" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </div>

      <!-- Two steps, because this is the only action here that destroys
           anything the owner can't retype. Typing the title is the confirmation:
           a trip is deleted rarely enough that the friction costs nothing, and
           it makes deleting the wrong trip from a list of similar names hard. -->
      <div v-if="armDelete" class="danger">
        <p class="danger-what">
          Deletes <strong>{{ props.trip.title }}</strong> and its campsites.
          Photos filed under it survive, unfiled, in the gallery.
        </p>
        <label>
          Type the trip's name to confirm
          <input v-model="deleteConfirm" type="text" :placeholder="props.trip.title" />
        </label>
        <p v-if="deleteError" class="error">{{ deleteError }}</p>
        <button
          type="button"
          class="delete"
          :disabled="deleteConfirm.trim() !== props.trip.title || deleting"
          @click="removeTrip"
        >
          {{ deleting ? 'Deleting…' : 'Delete permanently' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.editor {
  width: min(44rem, calc(100vw - 2rem));
  max-height: calc(100vh - 4rem);
  /* The form is taller than the viewport once the map is in it, and a
     <dialog> does not scroll on its own — without this the Save button
     is simply unreachable. */
  overflow-y: auto;
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.editor::backdrop {
  background: rgb(15 23 42 / 0.7);
}

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.editor-head h2 {
  margin: 0;
  font-size: 1.1rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}

label > span {
  color: #94a3b8;
}

input,
textarea {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.4rem;
  padding: 0.6rem 0.7rem;
  color: #e2e8f0;
  font-size: 1rem;
  font-family: inherit;
  width: 100%;
}

input:focus,
textarea:focus {
  outline: 2px solid #38bdf8;
  outline-offset: 1px;
}

textarea {
  resize: vertical;
}

.pair {
  display: flex;
  gap: 1rem;
}

.pair label {
  flex: 1;
  min-width: 0;
}

@media (max-width: 34rem) {
  .pair {
    flex-direction: column;
  }
}

.derived {
  margin: -0.25rem 0 0;
  color: #38bdf8;
  font-size: 0.85rem;
}

.error {
  color: #f87171;
  margin: 0;
}

.points {
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem 1rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.points legend {
  color: #94a3b8;
  font-size: 0.9rem;
  padding: 0 0.35rem;
}

.point-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.point-label {
  color: #94a3b8;
  font-size: 0.9rem;
  min-width: 4.5rem;
}

.point-value {
  color: #64748b;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  margin-right: auto;
}

.ghost {
  background: none;
  border: 1px solid #334155;
  color: #94a3b8;
  border-radius: 0.4rem;
  padding: 0.3rem 0.7rem;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.ghost {
  color: #38bdf8;
}

.ghost:hover {
  border-color: #38bdf8;
}

.ghost.small {
  font-size: 0.8rem;
  padding: 0.25rem 0.6rem;
}

/* A strip rather than a grid: the badge is one choice among a trip's photos,
   and a full gallery inside an edit form would bury the fields below it. */
.badge-strip {
  list-style: none;
  display: flex;
  gap: 0.4rem;
  margin: 0;
  padding: 0.2rem 0 0.4rem;
  overflow-x: auto;
}

.badge-pick {
  display: block;
  padding: 0;
  background: none;
  border: 2px solid transparent;
  border-radius: 0.4rem;
  cursor: pointer;
  line-height: 0;
}

.badge-pick img {
  width: 4.5rem;
  height: 3.4rem;
  object-fit: cover;
  border-radius: 0.25rem;
  opacity: 0.6;
}

.badge-pick:hover img {
  opacity: 0.85;
}

.badge-pick.current {
  border-color: #38bdf8;
}

.badge-pick.current img {
  opacity: 1;
}

.form-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

/* Quiet until wanted: a link rather than a button, so it doesn't compete with
   Save for attention. */
.danger-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 0.85rem;
  color: #64748b;
  text-decoration: underline;
  cursor: pointer;
}

.danger-link:hover {
  color: #fb7185;
}

.danger {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 1rem;
  padding: 0.9rem;
  border: 1px solid #7f1d1d;
  border-radius: 0.5rem;
  background: #450a0a33;
}

.danger-what {
  margin: 0;
  font-size: 0.85rem;
  color: #fca5a5;
}

.danger label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: #94a3b8;
}

.danger input {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.35rem;
  color: #e2e8f0;
  font: inherit;
  padding: 0.4rem 0.5rem;
}

.delete {
  align-self: flex-start;
  background: none;
  border: 1px solid #7f1d1d;
  color: #fb7185;
  border-radius: 0.35rem;
  padding: 0.35rem 0.8rem;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.delete:hover:not(:disabled) {
  background: #7f1d1d;
  color: #fff;
}

.delete:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.primary {
  background: #38bdf8;
  color: #0f172a;
  border: none;
  border-radius: 0.5rem;
  padding: 0.65rem 1.25rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
