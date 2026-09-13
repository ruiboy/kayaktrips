<script setup lang="ts">
// One affordance for "change this", everywhere. Before this the same intent
// appeared as "Edit", "Edit trip" and a bare "Delete" sitting on the page
// itself, which made destructive and ordinary actions look alike and put the
// dangerous one within a single click of a reader's finger.
//
// Deleting now lives inside whatever dialog this opens, so reaching it means
// having already chosen to edit the thing.
defineProps<{
  // Named for a screen reader, since the control is an icon: "Edit Wombat's
  // Rest" rather than a page of identical "Edit" buttons.
  label: string
}>()
</script>

<template>
  <button class="edit" type="button" :title="label" :aria-label="label">
    <!-- A pencil, drawn rather than imported: one path is cheaper than any
         icon dependency, and it inherits colour from the button. -->
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M11.6 1.6a1.4 1.4 0 0 1 2 2l-.8.8-2-2 .8-.8ZM10 3.1l2 2L5.2 12H3.2v-2L10 3.1Z"
        fill="currentColor"
      />
    </svg>
  </button>
</template>

<style scoped>
.edit {
  display: inline-grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  flex: 0 0 auto;
  background: none;
  border: 1px solid transparent;
  border-radius: 0.35rem;
  color: #64748b;
  cursor: pointer;
  padding: 0;
}

.edit:hover,
.edit:focus-visible {
  color: #38bdf8;
  border-color: #334155;
}
</style>
