<script setup lang="ts">
useHead({
  title: 'Upload a photo — Kayak Trips',
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
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
const { data: trips } = await useAsyncData('trips-for-upload', async () => {
  const { data } = await supabase
    .from('trips')
    .select('id, slug, title, start_date, end_date')
    .order('start_date', { ascending: false })

  return (data ?? []) as TripOption[]
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

async function signOut() {
  await supabase.auth.signOut()
  await navigateTo('/')
}

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

  // `useSupabaseUser` gives the decoded JWT payload, not a User object, so the
  // uploader id is `sub` — there is no `id` claim. JwtPayload has an
  // `[key: string]: any` index signature, so a wrong claim name typechecks
  // fine and silently yields undefined; hence the explicit guard.
  const uploaderId = user.value?.sub
  if (!uploaderId) {
    status.value = 'error'
    errorMessage.value = 'Not signed in — reload the page and try again.'
    return
  }

  // Scoping by uploader keeps ownership legible in the bucket and leaves room
  // for per-user policies later without a migration.
  const ext = file.value.name.split('.').pop()
  const path = `${uploaderId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(path, file.value, { upsert: false })

  if (uploadError) {
    status.value = 'error'
    errorMessage.value = uploadError.message
    return
  }

  // The row is what the gallery reads, not the bucket. If this fails the file
  // is orphaned — invisible rather than broken, but worth surfacing.
  const trimmed = caption.value.trim()
  // Returning the row because the badge needs its id: the trip points at the
  // photo, not the other way round, so there's nothing to point at until the
  // insert has happened.
  const { data: inserted, error: insertError } = await supabase
    .from('photos')
    .insert({
      storage_path: path,
      uploaded_by: uploaderId,
      caption: trimmed || null,
      trip_id: tripId.value || null,
    })
    .select('id')
    .single()

  if (insertError) {
    status.value = 'error'
    errorMessage.value = `Uploaded, but not recorded: ${insertError.message}`
    return
  }

  // Non-fatal on purpose: the photo is filed either way, and a failed badge
  // update shouldn't read as a failed upload.
  badgeWarning.value = ''
  if (makeBadge.value && tripId.value && inserted) {
    const { error: badgeError } = await supabase
      .from('trips')
      .update({ badge_photo_id: (inserted as { id: string }).id })
      .eq('id', tripId.value)

    if (badgeError) {
      badgeWarning.value = `Uploaded, but not set as the badge: ${badgeError.message}`
    }
  }

  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  uploadedUrl.value = data.publicUrl
  status.value = 'done'
}
</script>

<template>
  <main class="wrap">
    <div class="topbar">
      <NuxtLink class="back" to="/">&larr; Back</NuxtLink>
      <span v-if="user" class="who">
        {{ user.email }}
        <button class="signout" @click="signOut">Sign out</button>
      </span>
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

.who {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  color: #94a3b8;
  font-size: 0.85rem;
}

.signout {
  background: none;
  border: 1px solid #334155;
  color: #94a3b8;
  border-radius: 0.35rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.signout:hover {
  border-color: #38bdf8;
  color: #38bdf8;
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
