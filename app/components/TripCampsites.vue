<script setup lang="ts">
import type { MapPoint } from '~/components/TripMap.vue'

const props = defineProps<{
  tripId: string
  startDate: string
  endDate: string
  // The trip's put-in and take-out, drawn in the editor's map so you can see
  // where along the river you're placing a night.
  contextPoints: MapPoint[]
}>()

const { isEditor } = useEditor()

// RATINGS, the Campsite type and the query all live in the composable now: the
// map on the trip page needs the same rows, and sharing the keyed fetch keeps
// the list and the markers from drifting apart.
const { data: campsites, error } = await useCampsites(() => props.tripId)

// Form state. `editingId` null means the dialog is composing a new campsite.
const dialog = ref<HTMLDialogElement | null>(null)
const editingId = ref<string | null>(null)
const saving = ref(false)
const formError = ref('')
function numberOrNull(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

// The trip's endpoints for context, plus this campsite wherever it currently
// sits in the draft.
const draftPoints = computed<MapPoint[]>(() => {
  const lat = numberOrNull(draft.lat)
  const lon = numberOrNull(draft.lon)
  if (lat === null || lon === null) return props.contextPoints
  return [
    ...props.contextPoints,
    {
      id: 'draft',
      kind: 'campsite',
      label: draft.name || 'This campsite',
      lat,
      lon,
    },
  ]
})

function onPlace({ lat, lon }: { lat: number; lon: number }) {
  const round = (value: number) => String(Number(value.toFixed(6)))
  draft.lat = round(lat)
  draft.lon = round(lon)
}

function clearPoint() {
  draft.lat = ''
  draft.lon = ''
}

const mapPicker = ref<{ show: () => void } | null>(null)

const blankRatings = () =>
  Object.fromEntries(RATINGS.map(({ key }) => [key, ''])) as Record<
    RatingKey,
    string
  >

const draft = reactive({
  name: '',
  camped_on: '',
  notes: '',
  lat: '',
  lon: '',
  ...blankRatings(),
})

// Most nights you camp the day after the last one you recorded, so that's the
// date the form opens on — the put-in date when there's nothing yet.
function suggestedNight() {
  const sites = campsites.value ?? []
  const last = sites[sites.length - 1]
  return last ? isoDayAfter(last.camped_on) : props.startDate
}

function openNew() {
  editingId.value = null
  formError.value = ''
  Object.assign(draft, {
    name: '',
    camped_on: suggestedNight(),
    notes: '',
    lat: '',
    lon: '',
    ...blankRatings(),
  })
  dialog.value?.showModal()
}

function openEdit(site: Campsite) {
  editingId.value = site.id
  formError.value = ''
  Object.assign(draft, {
    name: site.name,
    camped_on: site.camped_on,
    notes: site.notes ?? '',
    lat: site.lat === null ? '' : String(site.lat),
    lon: site.lon === null ? '' : String(site.lon),
    ...Object.fromEntries(
      RATINGS.map(({ key }) => [key, site[key] === null ? '' : String(site[key])]),
    ),
  })
  dialog.value?.showModal()
}

function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close()
}

// A running total while you score, so you can see the site land on 8.5 before
// you commit to it. Null until all five are set, matching the stored column.
const draftScore = computed(() => {
  const values = RATINGS.map(({ key }) => draft[key])
  if (values.some((value) => value === '')) return null
  return values.reduce((total, value) => total + Number(value), 0)
})

// A warning, not a block: the database doesn't constrain this, and camping the
// night before the official put-in is the kind of thing that actually happens.
const dateOutsideTrip = computed(
  () =>
    Boolean(draft.camped_on) &&
    (draft.camped_on < props.startDate || draft.camped_on > props.endDate),
)

async function save() {
  if (!draft.name.trim() || !draft.camped_on || saving.value) return

  saving.value = true
  formError.value = ''

  const fields = {
    name: draft.name.trim(),
    camped_on: draft.camped_on,
    notes: draft.notes.trim() || null,
    lat: numberOrNull(draft.lat),
    lon: numberOrNull(draft.lon),
    ...Object.fromEntries(
      RATINGS.map(({ key }) => [key, draft[key] === '' ? null : Number(draft[key])]),
    ),
  }

  // The route returns the saved row either way: it carries `score`, which is
  // generated, and computing it here would duplicate the rule the database
  // already owns. The recorder is taken from the verified token, not sent.
  let row: Campsite
  try {
    row = editingId.value
      ? await $fetch<Campsite>(`/api/campsites/${editingId.value}`, {
          method: 'PATCH',
          body: fields,
        })
      : await $fetch<Campsite>('/api/campsites', {
          method: 'POST',
          body: { ...fields, trip_id: props.tripId },
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

  const sites = campsites.value ?? []
  const existing = sites.findIndex((site) => site.id === row.id)
  if (existing === -1) sites.push(row)
  else sites[existing] = row
  sites.sort((a, b) => a.camped_on.localeCompare(b.camped_on))

  dialog.value?.close()
}

const deleting = ref<string | null>(null)
const listError = ref('')

async function remove(site: Campsite) {
  if (deleting.value) return
  if (!confirm(`Delete “${site.name}”? This can't be undone.`)) return

  deleting.value = site.id
  listError.value = ''

  try {
    await $fetch(`/api/campsites/${site.id}`, { method: 'DELETE' })
  } catch (error) {
    deleting.value = null
    listError.value =
      (error as { statusCode?: number })?.statusCode === 401
        ? "That campsite wasn't deleted — are you still signed in?"
        : ((error as { statusMessage?: string })?.statusMessage ??
          "That campsite wasn't deleted.")
    return
  }

  deleting.value = null
  campsites.value = (campsites.value ?? []).filter((row) => row.id !== site.id)
}

function ratingText(value: number | null) {
  return value === null ? '—' : String(value)
}
</script>

<template>
  <section class="campsites">
    <div class="head">
      <h2>Campsites</h2>
      <button v-if="isEditor" class="ghost" @click="openNew">Add a campsite</button>
    </div>

    <p v-if="error" class="error">Couldn't load campsites: {{ error.message }}</p>
    <p v-if="listError" class="error">{{ listError }}</p>

    <p v-if="!campsites?.length" class="empty">No campsites recorded yet.</p>

    <ol v-else class="list">
      <li v-for="site in campsites" :key="site.id">
        <div class="site-head">
          <div>
            <h3>{{ site.name }}</h3>
            <p class="when">{{ formatDay(site.camped_on) }}</p>
          </div>
          <p class="score">
            <template v-if="site.score !== null">
              <span class="value">{{ site.score }}</span
              ><span class="out-of">/10</span>
            </template>
            <span v-else class="unrated">Unrated</span>
          </p>
        </div>

        <p v-if="site.notes" class="notes">{{ site.notes }}</p>

        <dl class="ratings">
          <div v-for="rating in RATINGS" :key="rating.key">
            <dt><RatingIcon :name="rating.key" :label="rating.label" /></dt>
            <dd>
              <span class="value">{{ ratingText(site[rating.key]) }}</span
              ><span class="out-of">/2</span>
            </dd>
          </div>
        </dl>

        <p v-if="site.lat !== null && site.lon !== null" class="coords">
          {{ site.lat }}, {{ site.lon }}
        </p>

        <div v-if="isEditor" class="site-actions">
          <button class="ghost small" @click="openEdit(site)">Edit</button>
          <button
            class="delete"
            :disabled="deleting === site.id"
            @click="remove(site)"
          >
            {{ deleting === site.id ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </li>
    </ol>

    <!-- The tooltips are desktop-only in practice: there's no hover on a
         phone, which is where these are most often read. -->
    <ul v-if="campsites?.length" class="legend">
      <li v-for="rating in RATINGS" :key="rating.key">
        <RatingIcon :name="rating.key" :label="rating.label" decorative />
        <span>{{ rating.label }}</span>
      </li>
    </ul>

    <!-- Editors only: RLS would refuse the writes anyway, but there's no reason
         to ship the form to everyone who reads the page. -->
    <dialog
      v-if="isEditor"
      ref="dialog"
      class="editor"
      @click="onDialogClick"
    >
      <form @submit.prevent="save">
        <div class="editor-head">
          <h2>{{ editingId ? 'Edit campsite' : 'Add a campsite' }}</h2>
          <button type="button" class="ghost" @click="dialog?.close()">Close</button>
        </div>

        <label>
          <span>Name</span>
          <input v-model="draft.name" type="text" maxlength="120" required />
        </label>

        <label>
          <span>Night of</span>
          <input v-model="draft.camped_on" type="date" required />
        </label>

        <p v-if="dateOutsideTrip" class="warn">
          That's outside the trip's dates. Saving anyway is fine.
        </p>

        <label>
          <span>Notes <em>(optional)</em></span>
          <textarea v-model="draft.notes" rows="3" maxlength="2000" />
        </label>

        <fieldset class="scores">
          <legend>
            Rating
            <span class="running">
              {{ draftScore === null ? 'incomplete' : `${draftScore}/10` }}
            </span>
          </legend>

          <label v-for="rating in RATINGS" :key="rating.key" class="score-field">
            <span>{{ rating.label }}</span>
            <select v-model="draft[rating.key]">
              <option value="">—</option>
              <option value="0">0</option>
              <option value="0.5">0.5</option>
              <option value="1">1</option>
              <option value="1.5">1.5</option>
              <option value="2">2</option>
            </select>
          </label>
        </fieldset>

        <fieldset class="points">
          <legend>Where it was</legend>

          <div class="point-row">
            <span class="point-value">
              {{ draft.lat && draft.lon ? `${draft.lat}, ${draft.lon}` : 'Not placed' }}
            </span>
            <button type="button" class="ghost small" @click="mapPicker?.show()">
              {{ draft.lat ? 'Move' : 'Set' }} on map
            </button>
            <button
              v-if="draft.lat"
              type="button"
              class="ghost small"
              @click="clearPoint"
            >
              Clear
            </button>
          </div>
        </fieldset>

        <p v-if="formError" class="error">{{ formError }}</p>

        <button type="submit" class="primary" :disabled="saving">
          {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Add campsite' }}
        </button>
      </form>

      <MapPickerDialog
        ref="mapPicker"
        :points="draftPoints"
        :title="draft.name ? `Place ${draft.name}` : 'Place the campsite'"
        @place="onPlace"
      />
    </dialog>
  </section>
</template>

<style scoped>
/* No top margin: the page places this in a column and owns the spacing above
   it, so the two columns start level. */
.campsites {
  min-width: 0;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.head h2 {
  margin: 0;
  font-size: 1.1rem;
}

.ghost {
  color: #38bdf8;
  background: none;
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

.ghost.small {
  font-size: 0.8rem;
  padding: 0.2rem 0.55rem;
}

.ghost.armed {
  border-color: #38bdf8;
  background: #38bdf8;
  color: #0f172a;
}

.empty {
  color: #94a3b8;
}

.error {
  color: #f87171;
}

.warn {
  color: #fbbf24;
  font-size: 0.85rem;
  margin: -0.25rem 0 0;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.list > li {
  background: #1e293b;
  border-radius: 0.75rem;
  padding: 1.25rem;
  /* The card is what the ratings grid measures itself against. */
  container-type: inline-size;
}

.site-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.site-head h3 {
  margin: 0;
  font-size: 1rem;
}

.when {
  margin: 0.15rem 0 0;
  color: #94a3b8;
  font-size: 0.85rem;
}

/* A fixed footprint so the block is the same size on every card whatever the
   score, with room between it and a long campsite name. */
.score {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #a3e635;
  white-space: nowrap;
  flex: 0 0 auto;
  min-width: 5rem;
  padding-left: 1rem;
  text-align: right;
}

/* A fixed box for the number so a 5 and a 6.5 take the same room, and the
   "/10" and "/2" sit at the same offset on every card instead of sliding
   with the digit count. */
.value {
  display: inline-block;
  min-width: 1.9rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Right-aligned, so "1" and "1.5" both sit against their "/2" and the slack
   falls after the icon. Left-aligned the number floats away from the
   denominator and the pair stops reading as one figure. */
.ratings .value {
  min-width: 1.6rem;
}

.out-of {
  color: #64748b;
  font-size: 0.75em;
  font-weight: 400;
}

.unrated {
  font-size: 0.85rem;
  font-weight: 400;
  color: #64748b;
}

.notes {
  margin: 0.75rem 0 0;
  line-height: 1.5;
  white-space: pre-wrap;
}

/* Explicit columns rather than wrapping. Left to wrap, a 1.5 being wider than
   a 1 broke one campsite 3-and-2 and the next 4-and-1; and even at a fixed
   width, wrapping gives you 4-and-1 at any width where four happen to fit.
   Three columns can only ever break 3-and-2, which is the fallback anywhere
   container queries aren't supported. */
.ratings {
  margin: 1rem 0 0;
  display: grid;
  /* `1fr` rather than a fixed width, so the row fills the card. Still an
     explicit column count: three can only break 3-and-2, never 4-and-1, and
     the columns line up between the two rows when it does. */
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem 1rem;
}

/* 5 × 4rem + 4 × 1rem of gap. Measured against the card, not the viewport —
   the campsites list is a column whose width the viewport alone doesn't tell
   you. */
@container (min-width: 24rem) {
  .ratings {
    grid-template-columns: repeat(5, 1fr);
  }
}

.ratings > div {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.ratings dt {
  display: flex;
}

.ratings dd {
  margin: 0;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.coords {
  margin: 0.75rem 0 0;
  color: #64748b;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.site-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

/* Spread across the column: equal cells that fill the width and drop to fewer
   per row when there isn't space, rather than huddling at the left. */
.legend {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0 0.25rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
  gap: 0.5rem;
  color: #64748b;
  font-size: 0.75rem;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.delete {
  background: none;
  border: 1px solid transparent;
  color: #64748b;
  border-radius: 0.35rem;
  padding: 0.2rem 0.55rem;
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

.point-value {
  color: #64748b;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  margin-right: auto;
}

.editor {
  width: min(40rem, calc(100vw - 2rem));
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

.editor form {
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

.editor label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}

.editor label > span {
  color: #94a3b8;
}

.editor em {
  font-style: normal;
  color: #64748b;
}

.editor input,
.editor textarea,
.editor select {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.4rem;
  padding: 0.6rem 0.7rem;
  color: #e2e8f0;
  font-size: 1rem;
  font-family: inherit;
  width: 100%;
}

.editor input:focus,
.editor textarea:focus,
.editor select:focus {
  outline: 2px solid #38bdf8;
  outline-offset: 1px;
}

.editor textarea {
  resize: vertical;
}

.scores {
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem 1rem;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
  gap: 0.75rem;
}

.scores legend {
  color: #94a3b8;
  font-size: 0.9rem;
  padding: 0 0.35rem;
}

.running {
  color: #38bdf8;
  font-variant-numeric: tabular-nums;
}

.score-field select {
  padding: 0.4rem 0.5rem;
}

.pair {
  display: flex;
  gap: 1rem;
}

.pair label {
  flex: 1;
  min-width: 0;
}

@media (max-width: 30rem) {
  .pair {
    flex-direction: column;
  }
}

.primary {
  background: #38bdf8;
  color: #0f172a;
  font-weight: 600;
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
