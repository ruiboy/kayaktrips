<script setup lang="ts">
useHead({
  title: 'Upload a photo — Kayak Trips',
})

const { isEditor } = useEditor()
const route = useRoute()

type TripOption = {
  id: string
  slug: string
  title: string
  start_date: string
  end_date: string
}

// Photos are filed at upload time — `photos` has no update policy, so a photo
// that lands unfiled stays unfiled. Hence the picker rather than a later step.
// Swallows its error rather than throwing: a trips query that fails shouldn't
// take the upload page down with it. Worst case the picker is empty and the
// photo lands unfiled.
// `useRequestFetch`, not bare `$fetch`: on Workers an internal fetch starts a
// fresh event without `context.cloudflare`, so the route would find no D1
// binding and fail server-side. This one carries the current event's context
// (and its cookies) through.
const requestFetch = useRequestFetch()
const { data: trips } = await useAsyncData('trips-for-upload', async () => {
  try {
    const rows = await requestFetch<TripOption[]>('/api/trips')
    return [...rows].reverse()
  } catch {
    return [] as TripOption[]
  }
})

// Arriving from a trip page pre-selects that trip; `?trip=` carries the slug
// because that's what the trip's own URL already has.
const tripId = ref(
  trips.value?.find((trip) => trip.slug === route.query.trip)?.id ?? '',
)

const selectedTrip = computed(
  () => trips.value?.find((trip) => trip.id === tripId.value) ?? null,
)

// A badge belongs to a trip, so the option only means anything once one is
// picked — clearing the trip clears the intent with it.
const makeBadge = ref(false)
watch(tripId, (value) => {
  if (!value) makeBadge.value = false
})

// Per-bucket size and MIME limits are a paid-plan feature, so this is the only
// place we can enforce them. It stops honest mistakes, not determined users —
// the backstop is Supabase's fixed 50 MB cap and the authenticated-only policy.
const MAX_BYTES = 10 * 1024 * 1024

const file = ref<File | null>(null)
const caption = ref('')
const status = ref<'idle' | 'uploading' | 'done' | 'error'>('idle')
const errorMessage = ref('')
const badgeWarning = ref('')
const uploadedUrl = ref('')

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const picked = target.files?.[0] ?? null

  status.value = 'idle'
  errorMessage.value = ''
  file.value = null

  if (!picked) return

  if (!picked.type.startsWith('image/')) {
    status.value = 'error'
    errorMessage.value = 'That file isn’t an image.'
    return
  }

  if (picked.size > MAX_BYTES) {
    const mb = (picked.size / 1024 / 1024).toFixed(1)
    status.value = 'error'
    errorMessage.value = `That photo is ${mb} MB — the limit is 10 MB.`
    return
  }

  file.value = picked
}

async function handleUpload() {
  if (!file.value) return

  status.value = 'uploading'
  errorMessage.value = ''
  badgeWarning.value = ''

  // Everything that decides where the file lands is the server's now — the
  // uploader, the storage key, the extension. Nothing here names a path, so
  // there is no field a tampered request could point somewhere else.
  const form = new FormData()
  form.append('file', file.value)
  form.append('caption', caption.value.trim())
  if (tripId.value) form.append('trip_id', tripId.value)
  if (makeBadge.value && tripId.value) form.append('badge', 'true')

  let result: { storage_path: string; badgeError: string | null }
  try {
    result = await $fetch('/api/photos', { method: 'POST', body: form })
  } catch (error) {
    status.value = 'error'
    errorMessage.value =
      (error as { statusCode?: number })?.statusCode === 401
        ? 'Not signed in — reload the page and try again.'
        : ((error as { statusMessage?: string })?.statusMessage ??
          'That upload failed.')
    return
  }

  // Non-fatal on purpose: the photo is filed either way, and a failed badge
  // update shouldn't read as a failed upload.
  if (result.badgeError) {
    badgeWarning.value = `Uploaded, but not set as the badge: ${result.badgeError}`
  }

  uploadedUrl.value = photoUrl(result.storage_path)
  status.value = 'done'
}
</script>

<template>
  <main class="wrap">
    <div class="topbar">
      <NuxtLink class="back" to="/">&larr; Back</NuxtLink>
      <AccountControl />
    </div>

    <h1>Upload a trip photo</h1>
    <p class="lede">Straight to Supabase Storage.</p>

    <div class="card">
      <input type="file" accept="image/*" @change="onFileChange" />

      <label class="caption-field">
        <span>Trip <em>(optional)</em></span>
        <select v-model="tripId">
          <option value="">Not filed under a trip</option>
          <option v-for="trip in trips" :key="trip.id" :value="trip.id">
            {{ trip.title }} — {{ formatDateRange(trip.start_date, trip.end_date) }}
          </option>
        </select>
      </label>

      <label v-if="tripId" class="badge-field">
        <input v-model="makeBadge" type="checkbox" />
        <span>Use as this trip's badge</span>
      </label>

      <label class="caption-field">
        <span>Caption <em>(optional)</em></span>
        <input
          v-model="caption"
          type="text"
          maxlength="200"
          placeholder="Day 3, camped above the lock"
        />
      </label>

      <button :disabled="!file || status === 'uploading'" @click="handleUpload">
        {{ status === 'uploading' ? 'Uploading…' : 'Upload' }}
      </button>

      <p v-if="status === 'error'" class="error">{{ errorMessage }}</p>

      <div v-if="status === 'done'" class="result">
        <p class="success">Uploaded.</p>
        <p v-if="badgeWarning" class="error">{{ badgeWarning }}</p>
        <img :src="uploadedUrl" alt="Uploaded trip photo" />
        <NuxtLink
          v-if="selectedTrip"
          class="gallery-link"
          :to="`/trips/${selectedTrip.slug}`"
        >
          See it on {{ selectedTrip.title }} &rarr;
        </NuxtLink>
        <NuxtLink v-else class="gallery-link" to="/photos">
          See it in the gallery &rarr;
        </NuxtLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 32rem;
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

.back {
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.9rem;
}

h1 {
  margin: 1rem 0 0.5rem;
}

.lede {
  color: #94a3b8;
  margin: 0 0 1.5rem;
}

.card {
  background: #1e293b;
  border-radius: 0.75rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

button {
  background: #38bdf8;
  color: #0f172a;
  font-weight: 600;
  border: none;
  border-radius: 0.5rem;
  padding: 0.65rem 1.25rem;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: #f87171;
}

.success {
  color: #4ade80;
  font-weight: 600;
}

.result img {
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 0.5rem 0;
}

.gallery-link {
  color: #38bdf8;
  font-size: 0.9rem;
  text-decoration: none;
}

.caption-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}

.caption-field span {
  color: #94a3b8;
}

.caption-field em {
  font-style: normal;
  color: #64748b;
}

.caption-field input {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.4rem;
  padding: 0.6rem 0.7rem;
  color: #e2e8f0;
  font-size: 1rem;
}

.caption-field select {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.4rem;
  padding: 0.6rem 0.7rem;
  color: #e2e8f0;
  font-size: 1rem;
  font-family: inherit;
}

.badge-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #94a3b8;
  cursor: pointer;
}

.badge-field input {
  width: 1rem;
  height: 1rem;
  accent-color: #38bdf8;
  cursor: pointer;
}

.caption-field input:focus,
.caption-field select:focus {
  outline: 2px solid #38bdf8;
  outline-offset: 1px;
}
</style>
