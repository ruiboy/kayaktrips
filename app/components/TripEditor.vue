<script setup lang="ts">
import type { MapPoint } from '~/components/TripMap.vue'

export type EditableTrip = {
  id: string
  // The trip is addressed by slug in the API, so the editor needs it even
  // though nothing here can change it.
  slug: string
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

const props = defineProps<{ trip: EditableTrip }>()
const emit = defineEmits<{ saved: [EditableTrip] }>()


const dialog = ref<HTMLDialogElement | null>(null)
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
})

const asText = (value: number | null) => (value === null ? '' : String(value))

function show() {
  formError.value = ''
  target.value = 'start'
  Object.assign(draft, {
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

      <MapPickerDialog
        ref="mapPicker"
        :points="draftPoints"
        :title="target === 'start' ? 'Place the put-in' : 'Place the take-out'"
        @place="onPlace"
      />

      <p v-if="formError" class="error">{{ formError }}</p>

      <button type="submit" class="primary" :disabled="saving">
        {{ saving ? 'Saving…' : 'Save changes' }}
      </button>
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
