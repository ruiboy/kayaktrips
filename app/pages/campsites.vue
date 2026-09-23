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
} & Record<RatingKey, number | null>

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

// What the site did well: an icon for each category scored 1.5 or 2, in the
// usual order. The numbers themselves stay on the trip page.
function strengths(site: RankedCampsite) {
  return RATINGS.filter(({ key }) => (site[key] ?? 0) >= 1.5)
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
      <SiteNav trail="Campsites" />
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
        <!-- The whole card is the link, and the fragment is what TripCampsites
             scrolls to and flashes — so a trip with nine nights doesn't drop
             you at the top of the page to find the one you clicked. One link
             rather than a word inside the card: the card is about one campsite,
             so every part of it is pointing at the same place. -->
        <NuxtLink class="card" :to="`/trips/${site.trip_slug}#campsite-${site.id}`">
          <div class="about">
            <h2>{{ site.name }}</h2>
            <p class="trip">{{ site.trip_title }}</p>
            <p class="when">{{ formatDay(site.camped_on) }}</p>
          </div>

          <div class="side">
            <p class="score">
              <template v-if="site.score !== null">
                {{ site.score }}<span class="out-of">/10</span>
              </template>
              <span v-else class="unrated">Unrated</span>
            </p>

            <ul v-if="strengths(site).length" class="strengths">
              <li v-for="rating in strengths(site)" :key="rating.key">
                <RatingIcon
                  :name="rating.key"
                  :label="`${rating.label}: ${site[rating.key]}/2`"
                />
              </li>
            </ul>
          </div>
        </NuxtLink>
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
.card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  background: #1e293b;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  height: 100%;
  color: inherit;
  text-decoration: none;
  /* A ring rather than a border, so hovering doesn't move the contents by a
     pixel. */
  transition: background 0.12s, box-shadow 0.12s;
}

.card:hover {
  background: #243244;
  box-shadow: 0 0 0 1px #38bdf8;
}

.card:focus-visible {
  outline: 2px solid #38bdf8;
  outline-offset: 2px;
}

.about {
  min-width: 0;
}

/* Score on top, the strengths beneath it, both against the right edge — the
   space under the score was empty, and it keeps the name's column clear. */
.side {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.45rem;
}

.strengths {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 0.35rem;
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

/* Still the accent: the card goes to that trip, so the colour isn't promising
   anything it doesn't do. */
.trip {
  color: #38bdf8;
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
