<script setup lang="ts">
useHead({
  title: 'Campsites — Kayak Trips',
})

type RankedCampsite = {
  id: string
  name: string
  camped_on: string
  score: number | null
  trip_slug: string
  trip_title: string
}

// Public read, so this renders server-side for anonymous visitors too.
// `useRequestFetch`, not bare `$fetch`: on Workers an internal fetch starts a
// fresh event without `context.cloudflare`, so the route would find no D1
// binding and fail server-side.
const requestFetch = useRequestFetch()
const { data: campsites, error } = await useAsyncData('campsites-ranked', () =>
  requestFetch<RankedCampsite[]>('/api/campsites/ranked'),
)
</script>

<template>
  <main class="wrap">
    <div class="topbar">
      <SiteNav />
      <AccountControl />
    </div>

    <h1>Campsites</h1>
    <p class="lede">Every night on every trip, best first.</p>

    <p v-if="error" class="error">Couldn't load campsites: {{ error.message }}</p>

    <p v-else-if="!campsites?.length" class="empty">
      No campsites recorded yet. They're added from each trip's page.
    </p>

    <!-- Name, trip, night and total, nothing more: this page is for spotting
         the best sites, and the breakdown is on the trip page it links to.
         Read-only, since editing needs the trip's dates and map. -->
    <ol v-else class="list">
      <li v-for="site in campsites" :key="site.id">
        <div>
          <h2>{{ site.name }}</h2>
          <p class="trip">
            <NuxtLink :to="`/trips/${site.trip_slug}`">{{ site.trip_title }}</NuxtLink>
          </p>
          <p class="when">{{ formatDay(site.camped_on) }}</p>
        </div>

        <p class="score">
          <template v-if="site.score !== null">
            {{ site.score }}<span class="out-of">/10</span>
          </template>
          <span v-else class="unrated">Unrated</span>
        </p>
      </li>
    </ol>
  </main>
</template>

<style scoped>
.wrap {
  max-width: var(--page-width);
  margin: 0 auto;
  padding: 2rem;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

h1 {
  margin: 1rem 0 0.5rem;
}

.lede {
  margin: 0 0 1.5rem;
  color: #94a3b8;
}

.empty {
  color: #94a3b8;
}

.error {
  color: #f87171;
}

/* Side by side in rank order, one column on a phone. */
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(20rem, 100%), 1fr));
  gap: 0.75rem;
}

/* Type and colours follow the campsite cards on the trip page, so a site
   reads the same in both places. */
.list li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  background: #1e293b;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
}

.list li > div {
  min-width: 0;
}

h2 {
  margin: 0;
  font-size: 1rem;
}

.trip,
.when {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
}

.trip a {
  color: #38bdf8;
  text-decoration: none;
}

.trip a:hover {
  text-decoration: underline;
}

.when {
  color: #94a3b8;
}

.score {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #a3e635;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.out-of {
  color: #64748b;
  font-size: 0.75em;
  font-weight: 400;
}

.unrated {
  font-size: 0.85rem;
  font-weight: 400;
  color: #64748b;
}
</style>
