<script setup lang="ts">
// Anything a trip points at that isn't a photo: the video of the run, a report
// someone wrote, the gauge you watched before going. A YouTube link plays
// where it sits; everything else is a link, because embedding the rest of the
// web is a promise this can't keep.
const props = defineProps<{ tripId: string }>()

const { isEditor } = useEditor()

export type Link = {
  id: string
  url: string
  label: string | null
  created_at: string
}

// Local to this component rather than a keyed composable: unlike campsites,
// nothing else on the page draws from these rows.
//
// `useRequestFetch`, not bare `$fetch`: on Workers an internal fetch starts a
// fresh event without `context.cloudflare`, so the route would find no D1
// binding and fail server-side.
const requestFetch = useRequestFetch()
const tripId = computed(() => props.tripId)
const { data: links, error } = await useAsyncData(
  () => `links:${tripId.value}`,
  () => requestFetch<Link[]>('/api/links', { query: { trip: tripId.value } }),
  { watch: [tripId] },
)

// ---- Editing ---------------------------------------------------------------

// One dialog for both jobs, as the campsite editor does: `editingId` null means
// it is composing a new link.
const dialog = ref<HTMLDialogElement | null>(null)
const editingId = ref<string | null>(null)
const saving = ref(false)
const deleting = ref(false)
const formError = ref('')
const draft = reactive({ url: '', label: '' })

function openNew() {
  editingId.value = null
  draft.url = ''
  draft.label = ''
  formError.value = ''
  dialog.value?.showModal()
}

function openEdit(link: Link) {
  editingId.value = link.id
  draft.url = link.url
  draft.label = link.label ?? ''
  formError.value = ''
  dialog.value?.showModal()
}

// <dialog> treats a backdrop click as a click on the dialog itself, so this
// only fires outside the panel.
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close()
}

function failure(cause: unknown, fallback: string) {
  return (cause as { statusCode?: number })?.statusCode === 401
    ? 'That was refused. Are you still signed in?'
    : ((cause as { statusMessage?: string })?.statusMessage ?? fallback)
}

async function save() {
  const url = draft.url.trim()
  if (!url || saving.value) return

  saving.value = true
  formError.value = ''
  const body = { url, label: draft.label.trim() || null }

  try {
    if (editingId.value) {
      const row = await $fetch<Link>(`/api/links/${editingId.value}`, {
        method: 'PATCH',
        body,
      })
      const at = links.value?.findIndex((link) => link.id === row.id) ?? -1
      if (at !== -1) links.value![at] = row
    } else {
      const row = await $fetch<Link>('/api/links', {
        method: 'POST',
        body: { ...body, trip_id: props.tripId },
      })
      links.value = [...(links.value ?? []), row]
    }
  } catch (cause) {
    saving.value = false
    formError.value = failure(cause, "That link didn't save.")
    return
  }

  saving.value = false
  dialog.value?.close()
}

// Delete lives in the dialog the pencil opens, never on the page itself.
async function remove() {
  const id = editingId.value
  if (!id || deleting.value) return

  const link = links.value?.find((row) => row.id === id)
  if (!confirm(`Remove ${link ? linkText(link.url, link.label) : 'this link'}?`)) return

  deleting.value = true
  formError.value = ''

  try {
    await $fetch(`/api/links/${id}`, { method: 'DELETE' })
    links.value = links.value?.filter((row) => row.id !== id) ?? null
  } catch (cause) {
    deleting.value = false
    formError.value = failure(cause, "That link wasn't removed.")
    return
  }

  deleting.value = false
  dialog.value?.close()
}
</script>

<template>
  <section class="links">
    <div class="head">
      <h2>Links</h2>
      <button v-if="isEditor" class="ghost" @click="openNew">Add a link</button>
    </div>

    <p v-if="error" class="error">Couldn't load links: {{ error.message }}</p>

    <p v-else-if="!links?.length" class="empty">Nothing linked to this trip yet.</p>

    <ul v-else class="list">
      <li v-for="link in links" :key="link.id">
        <!-- A video plays in place. `loading="lazy"` holds YouTube's player —
             about a megabyte of it — until the frame is nearly in view, so a
             trip with a video costs nothing to anyone who doesn't scroll to
             it. The nocookie host is YouTube's own and sets no tracking
             cookie until you press play. -->
        <template v-if="youtubeVideo(link.url)">
          <div class="embed">
            <iframe
              :src="youtubeEmbedUrl(youtubeVideo(link.url)!)"
              :title="linkText(link.url, link.label)"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            />
          </div>
          <p class="row">
            <span class="label">{{ link.label }}</span>
            <EditButton
              v-if="isEditor"
              class="inline-edit"
              :label="`Edit ${linkText(link.url, link.label)}`"
              @click="openEdit(link)"
            />
          </p>
        </template>

        <p v-else class="row">
          <!-- Someone else's site, so it opens in its own tab and carries no
               handle back to this one. -->
          <a :href="link.url" target="_blank" rel="noopener noreferrer">
            {{ linkText(link.url, link.label) }}
          </a>
          <EditButton
            v-if="isEditor"
            class="inline-edit"
            :label="`Edit ${linkText(link.url, link.label)}`"
            @click="openEdit(link)"
          />
        </p>
      </li>
    </ul>

    <!-- Editors only: the write routes would refuse anyone else, but there's no
         reason to ship the form to every reader. -->
    <dialog v-if="isEditor" ref="dialog" class="editor" @click="onDialogClick">
      <div class="inner">
        <h3>{{ editingId ? 'Edit link' : 'Add a link' }}</h3>

        <label>
          Link
          <input
            v-model="draft.url"
            type="url"
            inputmode="url"
            placeholder="https://"
            @keydown.enter.prevent="save"
          />
        </label>

        <label>
          Label <span class="hint">optional</span>
          <input
            v-model="draft.label"
            type="text"
            maxlength="120"
            :placeholder="youtubeVideo(draft.url) ? 'What the video shows' : 'What this is'"
            @keydown.enter.prevent="save"
          />
        </label>

        <p v-if="formError" class="error">{{ formError }}</p>

        <div class="foot">
          <button v-if="editingId" class="delete" :disabled="deleting" @click="remove">
            {{ deleting ? 'Removing…' : 'Remove' }}
          </button>
          <div class="foot-right">
            <button class="ghost" @click="dialog?.close()">Cancel</button>
            <button class="primary" :disabled="saving || !draft.url.trim()" @click="save">
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  </section>
</template>

<style scoped>
/* No top margin: the page owns the spacing between this and the photos above
   it, the same as the other column sections. */
.links {
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

.empty {
  color: #94a3b8;
}

.error {
  color: #f87171;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.embed {
  /* The player letterboxes anything that isn't 16:9 itself, a short included,
     which is better than a column that changes width per video. */
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 0.5rem;
  overflow: hidden;
}

.embed iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

/* Same shape as a photo caption: the pencil runs on from the text so it keeps
   to the last line of one that wraps. */
.row {
  margin: 0.4rem 0 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.row a {
  color: #38bdf8;
  text-decoration: none;
}

.row a:hover {
  text-decoration: underline;
}

.inline-edit {
  vertical-align: -0.35em;
  margin-left: 0.15rem;
}

.editor {
  color: #e2e8f0;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  width: min(26rem, calc(100vw - 2rem));
  padding: 1.25rem;
}

.editor::backdrop {
  background: #0f172abf;
}

.inner {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.inner h3 {
  margin: 0;
  font-size: 1rem;
}

.inner label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: #94a3b8;
}

.hint {
  color: #64748b;
  font-style: italic;
}

.inner input {
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

/* Keeps Cancel and Save to the right when there is no Remove beside them. */
.foot-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.ghost,
.delete {
  background: none;
  border: 1px solid #334155;
  color: #94a3b8;
  border-radius: 0.4rem;
  padding: 0.35rem 0.75rem;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.head .ghost {
  color: #38bdf8;
  font-size: 0.9rem;
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
