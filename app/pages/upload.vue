<script setup lang="ts">
useHead({
  title: 'Upload a photo — Kayak Trips',
})

const supabase = useSupabaseClient()

const file = ref<File | null>(null)
const status = ref<'idle' | 'uploading' | 'done' | 'error'>('idle')
const errorMessage = ref('')
const uploadedUrl = ref('')

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  file.value = target.files?.[0] ?? null
  status.value = 'idle'
  errorMessage.value = ''
}

async function handleUpload() {
  if (!file.value) return

  status.value = 'uploading'
  errorMessage.value = ''

  const ext = file.value.name.split('.').pop()
  const path = `poc/${Date.now()}-${crypto.randomUUID()}.${ext}`

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
    <NuxtLink class="back" to="/">&larr; Back</NuxtLink>
    <h1>Upload a trip photo</h1>
    <p class="lede">
      Straight to Supabase Storage, no login required in this POC.
    </p>

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

.result a {
  color: #94a3b8;
  font-size: 0.85rem;
  word-break: break-all;
}
</style>
