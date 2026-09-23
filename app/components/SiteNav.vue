<script setup lang="ts">
// Replaced breadcrumbs, which on a site two levels deep spent a line telling
// you that /trips is under Home. A nav does the thing a trail can't: move you
// sideways, from a trip to the photos without going up first.
//
// The wordmark is the way home, so no crumb has to be.
// The page a section leads to, when the page is one level in: the trip's title
// on a trip page. Given one, the section becomes a trail — `Trips › Mega Kayak
// Trip 1` — with the leaf carrying the mark for where you are and the section
// name beside it reading plainly as the way back up.
const props = defineProps<{ trail?: string }>()

const route = useRoute()

const SECTIONS = [
  { label: 'Trips', to: '/trips' },
  { label: 'Photos', to: '/photos' },
  { label: 'Maps', to: '/maps' },
]

// The underline means *this page*, wherever that page sits. One level into a
// section it moves onto the trail's leaf, so the section's own name is left
// plain and reads as the way back.
//
// The two used to be one state, which made the nav on a trip page identical to
// the nav on the list of trips, and an underlined link reads as where you are —
// so the one route back to the list looked inert.
//
// A trip page is inside Trips, /upload inside Photos, and the campsite ranking
// inside Maps. The ranking is deliberately not a section of its own: it's
// reached from the foot of /maps so it doesn't become the headline.
// aria-current follows isExact alone: a screen reader was being told that a
// trip page *was* the Trips page.
function isExact(to: string) {
  return route.path === to
}

function isInside(to: string) {
  if (isExact(to)) return false
  if (to === '/photos') return route.path.startsWith('/photos/') || route.path.startsWith('/upload')
  if (to === '/maps') return route.path.startsWith('/maps/') || route.path.startsWith('/campsites')
  return route.path.startsWith(`${to}/`)
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
          :class="{ current: isExact(section.to) }"
          :aria-current="isExact(section.to) ? 'page' : undefined"
        >
          {{ section.label }}
        </NuxtLink>

        <!-- Inline, inside the section's own slot, so the trail costs no row of
             its own — which is what was wrong with breadcrumbs here. -->
        <template v-if="isInside(section.to) && props.trail">
          <span class="sep" aria-hidden="true">›</span>
          <span class="leaf current" aria-current="page">{{ props.trail }}</span>
        </template>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.site-nav {
  display: flex;
  align-items: center;
  gap: 1.25rem;
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
  gap: 1rem;
  margin: 0;
  padding: 0;
  /* A trip's title can be long enough to need the next line on a phone. */
  flex-wrap: wrap;
}

li {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  min-width: 0;
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
.current {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
}

.sep {
  color: #475569;
  font-size: 0.9rem;
}

/* Where you are, so it is not a link: the page it would point at is this one. */
.leaf {
  font-size: 0.9rem;
  padding-bottom: 0.15rem;
  border-bottom: 2px solid #38bdf8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
</style>
