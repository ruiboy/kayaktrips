<script setup lang="ts">
// Replaced breadcrumbs, which on a site two levels deep spent a line telling
// you that /trips is under Home. A nav does the thing a trail can't: move you
// sideways, from a trip to the photos without going up first.
//
// The wordmark is the way home, so no crumb has to be.
const route = useRoute()

const SECTIONS = [
  { label: 'Trips', to: '/trips' },
  // "Camps", not "Campsites": with four sections the full word was what pushed
  // Sign in onto a second line on a phone.
  { label: 'Camps', to: '/campsites' },
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
    <!-- The badge, not the words: it is the thing the app is already known by,
         and it survives a narrow screen where a two-word mark would wrap or
         have to be dropped. -->
    <NuxtLink class="mark" to="/" aria-label="Kayak Trips — home">
      <img src="/mkt-crew.png" alt="" width="960" height="948" />
    </NuxtLink>

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
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex-wrap: wrap;
}

.mark {
  flex: 0 0 auto;
  display: block;
  line-height: 0;
  border-radius: 50%;
}

.mark img {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
  display: block;
}

.mark:hover img {
  filter: brightness(1.15);
}

.mark:focus-visible {
  outline: 2px solid #38bdf8;
  outline-offset: 2px;
}

ul {
  list-style: none;
  display: flex;
  gap: 0.75rem;
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
