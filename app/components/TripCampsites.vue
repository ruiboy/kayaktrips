<script setup lang="ts">
const props = defineProps<{
  tripId: string
  startDate: string
  endDate: string
}>()

// The order matters — it's the order they're scored in on the page and in the
// form, and it's the order you say them out loud.
const RATINGS = [
  { key: 'bankage', label: 'Bankage' },
  { key: 'campspots', label: 'Campspots' },
  { key: 'firewood', label: 'Firewood' },
  { key: 'shelter', label: 'Shelter' },
  { key: 'aesthetics', label: 'Aesthetics' },
] as const

type RatingKey = (typeof RATINGS)[number]['key']

type Campsite = {
  id: string
  name: string
  camped_on: string
  notes: string | null
  lat: number | null
  lon: number | null
  score: number | null
} & Record<RatingKey, number | null>

const SELECT_COLUMNS =
  'id, name, camped_on, notes, lat, lon, bankage, campspots, firewood,' +
  ' shelter, aesthetics, score'

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const { data: campsites, error } = await useAsyncData(
  () => `campsites:${props.tripId}`,
  async () => {
    const { data, error } = await supabase
      .from('campsites')
      .select(SELECT_COLUMNS)
      .eq('trip_id', props.tripId)
      .order('camped_on', { ascending: true })

    if (error) throw error
    return data as Campsite[]
  },
)

// Form state. `editingId` null means the dialog is composing a new campsite.
const dialog = ref<HTMLDialogElement | null>(null)
const editingId = ref<string | null>(null)
const saving = ref(false)
const formError = ref('')

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

function numberOrNull(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

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

  // `.select()` on every write: RLS refuses by matching no rows rather than
  // erroring, so the returned row is the only proof anything happened. It also
  // carries `score` back, which is generated and can't be computed client-side
  // without duplicating the rule.
  const query = editingId.value
    ? supabase.from('campsites').update(fields).eq('id', editingId.value)
    : supabase
        .from('campsites')
        .insert({ ...fields, trip_id: props.tripId, created_by: user.value?.sub })

  const { data: saved, error: saveError } = await query.select(SELECT_COLUMNS)

  saving.value = false

  if (saveError) {
    formError.value = saveError.message
    return
  }

  const row = (saved as Campsite[] | null)?.[0]
  if (!row) {
    formError.value = "The database refused that. Are you still signed in?"
    return
  }

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

  const { data: removed, error: deleteError } = await supabase
    .from('campsites')
    .delete()
    .eq('id', site.id)
    .select('id')

  deleting.value = null

  if (deleteError) {
    listError.value = deleteError.message
    return
  }

  if (!removed?.length) {
    listError.value = "That campsite wasn't deleted — the database refused it."
    return
  }

  campsites.value = (campsites.value ?? []).filter((row) => row.id !== site.id)
}

function ratingText(value: number | null) {
  return value === null ? '—' : String(value)
}

// Four bands out of ten, so a column of campsites can be read for quality
// without reading every number. The number is right there beside it, so the
// colour reinforces rather than carries the meaning on its own.
function scoreBand(score: number) {
  if (score >= 8) return 'great'
  if (score >= 6) return 'good'
  if (score >= 4) return 'fair'
  return 'poor'
}
</script>

<template>
  <section class="campsites">
    <div class="head">
      <h2>Campsites</h2>
      <button v-if="user" class="ghost" @click="openNew">Add a campsite</button>
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
          <p
            class="score"
            :class="site.score === null ? undefined : scoreBand(site.score)"
          >
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

        <div v-if="user" class="site-actions">
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
    <dialog v-if="user" ref="dialog" class="editor" @click="onDialogClick">
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

        <div class="pair">
          <label>
            <span>Latitude <em>(optional)</em></span>
            <input v-model="draft.lat" type="text" inputmode="decimal" placeholder="-34.0289" />
          </label>
          <label>
            <span>Longitude <em>(optional)</em></span>
            <input v-model="draft.lon" type="text" inputmode="decimal" placeholder="139.6712" />
          </label>
        </div>

        <p v-if="formError" class="error">{{ formError }}</p>

        <button type="submit" class="primary" :disabled="saving">
          {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Add campsite' }}
        </button>
      </form>
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
  color: #38bdf8;
  white-space: nowrap;
  flex: 0 0 auto;
  min-width: 5rem;
  padding-left: 1rem;
  text-align: right;
}

.score.great {
  color: #4ade80;
}

.score.good {
  color: #a3e635;
}

.score.fair {
  color: #fbbf24;
}

.score.poor {
  color: #fb7185;
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
  grid-template-columns: repeat(3, 4rem);
  justify-content: start;
  gap: 0.5rem 1rem;
}

/* 5 × 4rem + 4 × 1rem of gap. Measured against the card, not the viewport —
   the campsites list is a column whose width the viewport alone doesn't tell
   you. */
@container (min-width: 24rem) {
  .ratings {
    grid-template-columns: repeat(5, 4rem);
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

.editor {
  width: min(34rem, calc(100vw - 2rem));
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
