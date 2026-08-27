<script setup lang="ts">
useHead({
  title: 'Upload a photo — Kayak Trips',
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()

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
  const { error: insertError } = await supabase.from('photos').insert({
    storage_path: path,
    uploaded_by: uploaderId,
    caption: trimmed || null,
  })

  if (insertError) {
    status.value = 'error'
    errorMessage.value = `Uploaded, but not recorded: ${insertError.message}`
    return
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
        <img :src="uploadedUrl" alt="Uploaded trip photo" />
        <NuxtLink class="gallery-link" to="/photos">See it in the gallery &rarr;</NuxtLink>
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

.caption-field input:focus {
  outline: 2px solid #38bdf8;
  outline-offset: 1px;
}
</style>
