<script setup lang="ts">
// The only thing that can still be changed about a photo once it is uploaded:
// its caption, and whether it exists. Filing is set at upload time and the
// route refuses anything else, so this is not a general editor.
//
// Shared by the trip page and the gallery. Both had the same two needs, and an
// unfiled photo has no trip page to be edited from at all — which is why the
// gallery needs it more than the trip page does.
export type EditablePhoto = {
  id: string
  storage_path: string
  caption: string | null
}

const emit = defineEmits<{
  // The saved caption, folded back into whichever list opened this.
  saved: [{ id: string; caption: string | null }]
  deleted: [string]
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const photo = ref<EditablePhoto | null>(null)
const draft = ref('')
const saving = ref(false)
const deleting = ref(false)
const message = ref('')

function show(next: EditablePhoto) {
  photo.value = next
  draft.value = next.caption ?? ''
  message.value = ''
  dialog.value?.showModal()
}

// <dialog> treats a backdrop click as a click on the dialog itself, so this
// only fires outside the panel.
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close()
}

function failure(error: unknown, fallback: string) {
  return (error as { statusCode?: number })?.statusCode === 401
    ? 'That was refused. Are you still signed in?'
    : ((error as { statusMessage?: string })?.statusMessage ?? fallback)
}

async function save() {
  const current = photo.value
  if (!current || saving.value) return

  const next = draft.value.trim()
  // Nothing to write, so don't ask the server to prove it.
  if (next === (current.caption ?? '')) {
    dialog.value?.close()
    return
  }

  saving.value = true
  message.value = ''

  try {
    const row = await $fetch<{ id: string; caption: string | null }>(
      `/api/photos/${current.id}`,
      { method: 'PATCH', body: { caption: next } },
    )
    emit('saved', { id: row.id, caption: row.caption })
  } catch (error) {
    saving.value = false
    message.value = failure(error, 'That caption did not save.')
    return
  }

  saving.value = false
  dialog.value?.close()
}

async function remove() {
  const current = photo.value
  if (!current || deleting.value) return

  const label = current.caption ? `“${current.caption}”` : 'this photo'
  if (!confirm(`Delete ${label}? This can't be undone.`)) return

  deleting.value = true
  message.value = ''

  try {
    await $fetch(`/api/photos/${current.id}`, { method: 'DELETE' })
    emit('deleted', current.id)
  } catch (error) {
    deleting.value = false
    message.value = failure(error, "That photo wasn't deleted.")
    return
  }

  deleting.value = false
  dialog.value?.close()
}

defineExpose({ show })
</script>

<template>
  <dialog ref="dialog" class="photo-dialog" @click="onDialogClick">
    <div v-if="photo" class="inner">
      <img :src="thumbUrl(photo.storage_path)" :alt="photo.caption ?? ''" />

      <label class="caption-field">
        Caption
        <input
          v-model="draft"
          type="text"
          maxlength="200"
          placeholder="No caption"
          @keydown.enter.prevent="save"
        />
      </label>

      <p v-if="message" class="error">{{ message }}</p>

      <div class="foot">
        <button class="delete" :disabled="deleting" @click="remove">
          {{ deleting ? 'Deleting…' : 'Delete photo' }}
        </button>
        <div class="foot-right">
          <button class="ghost" @click="dialog?.close()">Cancel</button>
          <button class="primary" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.photo-dialog {
  color: #e2e8f0;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  width: min(22rem, calc(100vw - 2rem));
  padding: 1.25rem;
}

.photo-dialog::backdrop {
  background: #0f172abf;
}

.inner {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 0.5rem;
}

.caption-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: #94a3b8;
}

.caption-field input {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.35rem;
  color: #e2e8f0;
  font: inherit;
  padding: 0.45rem 0.55rem;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.foot-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.error {
  margin: 0;
  color: #fca5a5;
  font-size: 0.85rem;
}

.ghost,
.delete {
  background: none;
  border: 1px solid #334155;
  color: #94a3b8;
  border-radius: 0.35rem;
  padding: 0.35rem 0.75rem;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.ghost:hover {
  border-color: #38bdf8;
  color: #38bdf8;
}

.delete {
  border-color: #7f1d1d;
  color: #fb7185;
}

.delete:hover:not(:disabled) {
  background: #7f1d1d;
  color: #fff;
}

.delete:disabled,
.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary {
  background: #38bdf8;
  color: #0f172a;
  border: none;
  border-radius: 0.35rem;
  padding: 0.4rem 0.9rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
</style>
