<script setup lang="ts">
import type { MapPoint } from '~/components/TripMap.vue'

defineProps<{
  // Everything to draw. The point being placed should be among them, so it
  // moves as you click; the rest are context.
  points: MapPoint[]
  title: string
}>()

const emit = defineEmits<{ place: [{ lat: number; lon: number }] }>()

const dialog = ref<HTMLDialogElement | null>(null)
// Gates the map: a <dialog> is display:none until shown, so a map built inside
// a closed one measures zero. Closing unmounts it and releases its WebGL
// context, which matters when this stacks above another dialog.
const open = ref(false)

function show() {
  open.value = true
  dialog.value?.showModal()
}

function close() {
  dialog.value?.close()
}

function onClose() {
  open.value = false
}

function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

defineExpose({ show })
</script>

<template>
  <!-- Opened from inside another dialog. Native <dialog> stacks in the top
       layer, so this lands above the form rather than behind it. -->
  <dialog ref="dialog" class="picker" @click="onDialogClick" @close="onClose">
    <div class="head">
      <h2>{{ title }}</h2>
      <button type="button" class="primary" @click="close">Done</button>
    </div>

    <p class="hint">
      Click to place it. Click again to move it &mdash; nothing is saved until
      you save the form.
    </p>

    <ClientOnly>
      <TripMap
        v-if="open"
        :points="points"
        picking
        @place="(point) => emit('place', point)"
      />
    </ClientOnly>
  </dialog>
</template>

<style scoped>
.picker {
  width: min(52rem, calc(100vw - 2rem));
  max-height: calc(100vh - 4rem);
  overflow-y: auto;
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.picker::backdrop {
  background: rgb(15 23 42 / 0.75);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.head h2 {
  margin: 0;
  font-size: 1.1rem;
}

.hint {
  margin: 0 0 1rem;
  color: #64748b;
  font-size: 0.85rem;
}

.primary {
  background: #38bdf8;
  color: #0f172a;
  border: none;
  border-radius: 0.5rem;
  padding: 0.45rem 1.1rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
</style>
