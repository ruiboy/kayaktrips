<script setup lang="ts">
import type { TripPhoto } from '~/components/TripEditor.vue'

// The badge picker, lifted out of the trip page and opened from inside the
// trip editor instead. It stacks above that dialog the same way
// MapPickerDialog does — native <dialog> uses the top layer, so nesting is
// fine and Escape closes the innermost first.
//
// It chooses; it does not save. The trip editor holds the choice until the
// trip itself is saved, so backing out of the edit leaves the badge alone.
defineProps<{
  photos: TripPhoto[]
  selectedId: string | null
}>()

const emit = defineEmits<{ choose: [string | null] }>()

const dialog = ref<HTMLDialogElement | null>(null)

function show() {
  dialog.value?.showModal()
}

function pick(id: string) {
  emit('choose', id)
  dialog.value?.close()
}

// <dialog> treats a backdrop click as a click on the dialog itself, so this
// only fires outside the panel.
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close()
}

defineExpose({ show })
</script>

<template>
  <dialog ref="dialog" class="picker" @click="onDialogClick">
    <div class="picker-head">
      <h2>Choose the badge</h2>
      <button type="button" class="ghost" @click="dialog?.close()">Close</button>
    </div>
    <p class="picker-lede">
      The badge is the photo that stands for this trip in the list.
    </p>

    <ul class="picker-grid">
      <li v-for="photo in photos" :key="photo.id">
        <button
          type="button"
          class="pick"
          :class="{ current: photo.id === selectedId }"
          :aria-current="photo.id === selectedId ? 'true' : undefined"
          @click="pick(photo.id)"
        >
          <img
            :src="thumbUrl(photo.storage_path)"
            :alt="photo.caption ?? ''"
            loading="lazy"
          />
          <span>{{ photo.caption || 'Untitled' }}</span>
        </button>
      </li>
    </ul>
  </dialog>
</template>

<style scoped>
.picker {
  width: min(38rem, calc(100vw - 2rem));
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.picker::backdrop {
  background: rgb(15 23 42 / 0.7);
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.picker-head h2 {
  margin: 0;
  font-size: 1.1rem;
}

.picker-lede {
  margin: 0.5rem 0 1.25rem;
  color: #94a3b8;
  font-size: 0.9rem;
}

.picker-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  gap: 1rem;
  max-height: 60vh;
  overflow-y: auto;
}

.pick {
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

/* Circular, because that's how the badge renders on the trips list — the
   preview should show the crop you're actually choosing. */
.pick img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 50%;
  display: block;
  background: #0f172a;
  border: 2px solid transparent;
}

.pick:hover img {
  border-color: #38bdf8;
}

.pick.current img {
  border-color: #38bdf8;
}

.pick span {
  font-size: 0.8rem;
  color: #94a3b8;
  text-align: center;
  overflow-wrap: anywhere;
}

.pick.current span {
  color: #38bdf8;
}

.ghost {
  background: none;
  border: 1px solid #334155;
  color: #94a3b8;
  border-radius: 0.35rem;
  padding: 0.3rem 0.75rem;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.ghost:hover {
  border-color: #38bdf8;
  color: #38bdf8;
}
</style>
