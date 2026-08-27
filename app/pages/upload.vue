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

  // Scoping by uploader id keeps ownership legible in the bucket and leaves
  // room for per-user policies later without a migration.
  const ext = file.value.name.split('.').pop()
  const path = `${user.value?.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from('photos')
    .upload(path, file.value, { upsert: false })

  if (error) {
    status.value = 'error'
    errorMessage.value = error.message
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
      <button :disabled="!file || status === 'uploading'" @click="handleUpload">
        {{ status === 'uploading' ? 'Uploading…' : 'Upload' }}
      </button>

      <p v-if="status === 'error'" class="error">{{ errorMessage }}</p>

      <div v-if="status === 'done'" class="result">
        <p class="success">Uploaded.</p>
        <img :src="uploadedUrl" alt="Uploaded trip photo" />
        <a :href="uploadedUrl" target="_blank" rel="noopener">{{ uploadedUrl }}</a>
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

.result a {
  color: #94a3b8;
  font-size: 0.85rem;
  word-break: break-all;
}
</style>
