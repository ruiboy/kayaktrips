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

// Ranked by default, or by night across every trip. Kept in the query string
// so a reload or the back button from a trip page returns the same order.
// Sorted here rather than refetched: the route already sends every row.
const route = useRoute()
const router = useRouter()

const order = computed(() => (route.query.order === 'date' ? 'date' : 'ranked'))

function setOrder(next: 'ranked' | 'date') {
  router.replace({ query: { ...route.query, order: next === 'date' ? 'date' : undefined } })
}

const sorted = computed(() => {
  const rows = campsites.value ?? []
  if (order.value === 'ranked') return rows
  return [...rows].sort((a, b) => a.camped_on.localeCompare(b.camped_on))
})
</script>

<template>
  <main class="wrap">
    <div class="topbar">
      <SiteNav />
      <AccountControl />
    </div>

    <div class="head">
      <div>
        <h1>Campsites</h1>
        <p class="lede">Every night on every trip.</p>
      </div>

      <div class="order" role="group" aria-label="Order">
        <button
          type="button"
          :class="{ on: order === 'ranked' }"
          :aria-pressed="order === 'ranked'"
          @click="setOrder('ranked')"
        >
          Ranked
        </button>
        <button
          type="button"
          :class="{ on: order === 'date' }"
          :aria-pressed="order === 'date'"
          @click="setOrder('date')"
        >
          By date
        </button>
      </div>
    </div>

    <p v-if="error" class="error">Couldn't load campsites: {{ error.message }}</p>

    <p v-else-if="!campsites?.length" class="empty">
      No campsites recorded yet. They're added from each trip's page.
    </p>

    <!-- Name, trip, night and total, nothing more: the breakdown is on the
         trip page each links to. Read-only, since editing needs the trip's
         dates and map. -->
    <ol v-else class="list">
      <li v-for="site in sorted" :key="site.id">
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

/* Heading left, the order toggle level with it on the right; the toggle drops
   beneath the heading when there isn't room. */
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

h1 {
  margin: 1rem 0 0.5rem;
}

.lede {
  margin: 0;
  color: #94a3b8;
}

/* Two joined buttons, the current one filled — the same filled accent as an
   armed control elsewhere on the site. */
.order {
  display: inline-flex;
  border: 1px solid #334155;
  border-radius: 0.4rem;
  overflow: hidden;
}

.order button {
  background: none;
  border: none;
  color: #38bdf8;
  font: inherit;
  font-size: 0.85rem;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
}

.order button + button {
  border-left: 1px solid #334155;
}

.order button:hover:not(.on) {
  background: #1e293b;
}

.order button.on {
  background: #38bdf8;
  color: #0f172a;
  font-weight: 600;
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
