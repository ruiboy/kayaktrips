<script setup lang="ts">
// Replaced breadcrumbs, which on a site two levels deep spent a line telling
// you that /trips is under Home. A nav does the thing a trail can't: move you
// sideways, from a trip to the photos without going up first.
//
// The wordmark is the way home, so no crumb has to be.
const route = useRoute()

const SECTIONS = [
  { label: 'Trips', to: '/trips' },
  { label: 'Photos', to: '/photos' },
  { label: 'Maps', to: '/maps' },
]

// A trip page marks Trips, and /upload marks Photos — the section you are in is
// the one you'd go back to, not only the one whose path matches exactly.
function isCurrent(to: string) {
  if (to === '/photos') return route.path.startsWith('/photos') || route.path.startsWith('/upload')
  return route.path.startsWith(to)
}
</script>

<template>
  <nav class="site-nav" aria-label="Sections">
    <NuxtLink class="mark" to="/">Kayak Trips</NuxtLink>

    <ul>
      <li v-for="section in SECTIONS" :key="section.to">
        <NuxtLink
          :to="section.to"
          :class="{ current: isCurrent(section.to) }"
          :aria-current="isCurrent(section.to) ? 'page' : undefined"
        >
          {{ section.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.site-nav {
  display: flex;
  align-items: baseline;
  gap: 1.25rem;
  min-width: 0;
  flex-wrap: wrap;
}

.mark {
  color: #e2e8f0;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
}

.mark:hover {
  color: #38bdf8;
}

ul {
  list-style: none;
  display: flex;
  gap: 1rem;
  margin: 0;
  padding: 0;
}

a {
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.9rem;
  padding-bottom: 0.15rem;
  border-bottom: 2px solid transparent;
}

a:hover {
  color: #e2e8f0;
}

/* Underlined rather than merely coloured: on a dark palette a colour change
   alone reads as a hover state. */
a.current {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
}
</style>
