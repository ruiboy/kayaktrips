<script setup lang="ts">
// `decorative` is for the legend, where the name is already spelled out beside
// the icon — without it a screen reader reads "Bankage Bankage".
const props = withDefaults(
  defineProps<{
    name: 'bankage' | 'campspots' | 'firewood' | 'shelter' | 'aesthetics'
    label: string
    decorative?: boolean
  }>(),
  { decorative: false },
)

// Colours are per-icon rather than inherited: at this size the shape alone
// takes a moment to read, and the colour is what tells the five apart at a
// glance down a column of campsites. Two-tone where the material differs —
// brown logs under an orange flame, a brown trunk under a green canopy.
const WATER = '#38bdf8'
const SAND = '#facc15'
const CANVAS = '#fbbf24'
const FLAME = '#fb923c'
const WOOD = '#b45309'
const LEAF = '#4ade80'
const VIEW = '#c084fc'
</script>

<template>
  <!-- The <title> does double duty: it's the native hover tooltip and, with
       role="img", the accessible name — so the icon isn't a mystery to a
       screen reader or to anyone who can't hover. -->
  <svg
    class="icon"
    viewBox="0 0 24 24"
    :role="props.decorative ? undefined : 'img'"
    :aria-hidden="props.decorative ? 'true' : undefined"
    fill="none"
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <title v-if="!props.decorative">{{ label }}</title>

    <!-- Bankage: the shore you land on, water beneath it. -->
    <template v-if="name === 'bankage'">
      <path d="M2 4.5h6.5L15 11h7" :stroke="SAND" />
      <path d="M2 15.5c2.2-1.5 4.4-1.5 6.6 0s4.4 1.5 6.6 0 4.4-1.5 6.8 0" :stroke="WATER" />
      <path d="M2 19.5c2.2-1.5 4.4-1.5 6.6 0s4.4 1.5 6.6 0 4.4-1.5 6.8 0" :stroke="WATER" />
    </template>

    <!-- Campspots: somewhere to pitch. The door is open at the bottom — closed
         into a triangle it reads as a hazard sign. -->
    <template v-else-if="name === 'campspots'">
      <path d="M12 3.5 21 19.5H3Z" :stroke="CANVAS" />
      <path d="M9 19.5 12 12.5l3 7" :stroke="CANVAS" />
    </template>

    <!-- Firewood: a campfire — flame over crossed logs. -->
    <template v-else-if="name === 'firewood'">
      <path d="M12 2.5s3.9 4.4 3.9 7.3a3.9 3.9 0 1 1-7.8 0c0-2.9 3.9-7.3 3.9-7.3Z" :stroke="FLAME" />
      <path d="M3.5 20.5 20.5 15.5" :stroke="WOOD" />
      <path d="M3.5 15.5 20.5 20.5" :stroke="WOOD" />
    </template>

    <!-- Shelter: a broadleaf rather than a conifer, which at this size would
         read as a second tent. -->
    <template v-else-if="name === 'shelter'">
      <path d="M12 2.5a6 6 0 0 1 4.2 10.3 4.6 4.6 0 1 1-8.4 0A6 6 0 0 1 12 2.5Z" :stroke="LEAF" />
      <path d="M12 17.8v3.7" :stroke="WOOD" />
    </template>

    <!-- Aesthetics: what you're looking at. -->
    <template v-else>
      <circle cx="17.5" cy="6.5" r="2.5" :stroke="VIEW" />
      <path d="M2.5 19 9 9.5l3.5 5 2.5-3 6.5 7.5Z" :stroke="VIEW" />
    </template>
  </svg>
</template>

<style scoped>
.icon {
  width: 1.25rem;
  height: 1.25rem;
  display: block;
}
</style>
