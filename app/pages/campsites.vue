<script setup lang="ts">
useHead({
  title: 'Campsites — Kayak Trips',
})

type RankedCampsite = Omit<Campsite, 'notes' | 'lat' | 'lon'> & {
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

// The route already sorts rated sites first, so the split keeps its order.
// Unrated sites get no rank at all — ranking them last would say they were bad.
const rated = computed(() => (campsites.value ?? []).filter((site) => site.score !== null))
const unrated = computed(() => (campsites.value ?? []).filter((site) => site.score === null))

// Shared ranks for shared scores, then skip: 1, 2, 2, 4. Numbering by position
// would put one of two equal sites above the other for no reason.
const ranks = computed(() =>
  rated.value.map((site, index, sites) => {
    let first = index
    while (first > 0 && sites[first - 1].score === site.score) first--
    return first + 1
  }),
)

function ratingText(value: number | null) {
  return value === null ? '—' : String(value)
}
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

    <template v-else>
      <ol v-if="rated.length" class="list">
        <li v-for="(site, index) in rated" :key="site.id" class="site">
          <span class="rank">{{ ranks[index] }}</span>

          <div class="identity">
            <h2>{{ site.name }}</h2>
            <p class="when">
              <NuxtLink :to="`/trips/${site.trip_slug}`">{{ site.trip_title }}</NuxtLink>
              &middot; {{ formatDayWithYear(site.camped_on) }}
            </p>
          </div>

          <dl class="ratings">
            <div v-for="rating in RATINGS" :key="rating.key">
              <dt><RatingIcon :name="rating.key" :label="rating.label" /></dt>
              <dd>
                <span class="value">{{ ratingText(site[rating.key]) }}</span
                ><span class="out-of">/2</span>
              </dd>
            </div>
          </dl>

          <p class="score">
            <span class="value">{{ site.score }}</span><span class="out-of">/10</span>
          </p>
        </li>
      </ol>

      <template v-if="unrated.length">
        <h2 class="unrated-head">Not fully rated</h2>
        <!-- The same row as above, minus a rank and a total: a partial score
             is still worth seeing, but neither number would mean anything. -->
        <ul class="list">
          <li v-for="site in unrated" :key="site.id" class="site">
            <span class="rank" aria-hidden="true"></span>

            <div class="identity">
              <h2>{{ site.name }}</h2>
              <p class="when">
                <NuxtLink :to="`/trips/${site.trip_slug}`">{{ site.trip_title }}</NuxtLink>
                &middot; {{ formatDayWithYear(site.camped_on) }}
              </p>
            </div>

            <dl class="ratings">
              <div v-for="rating in RATINGS" :key="rating.key">
                <dt><RatingIcon :name="rating.key" :label="rating.label" /></dt>
                <dd>
                  <span class="value">{{ ratingText(site[rating.key]) }}</span
                  ><span class="out-of">/2</span>
                </dd>
              </div>
            </dl>

            <p class="score"><span class="unrated">Unrated</span></p>
          </li>
        </ul>
      </template>

      <ul class="legend">
        <li v-for="rating in RATINGS" :key="rating.key">
          <RatingIcon :name="rating.key" :label="rating.label" decorative />
          <span>{{ rating.label }}</span>
        </li>
      </ul>
    </template>
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

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* One row per site on a wide screen: rank, who and when, the five ratings,
   the total. A ranking reads down a single column, so no side-by-side cards. */
.site {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto auto;
  grid-template-areas: 'rank identity ratings score';
  align-items: center;
  gap: 0.5rem 1.5rem;
  background: #1e293b;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
}

/* On a phone the ratings drop to their own line under the name, and the
   score stays up top where the eye lands first. */
@media (max-width: 48rem) {
  .site {
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    grid-template-areas:
      'rank identity score'
      'ratings ratings ratings';
    column-gap: 0.75rem;
  }
}

.rank {
  grid-area: rank;
  color: #64748b;
  font-size: 1.1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.identity {
  grid-area: identity;
  min-width: 0;
}

.identity h2 {
  margin: 0;
  font-size: 1rem;
}

.when {
  margin: 0.15rem 0 0;
  color: #94a3b8;
  font-size: 0.85rem;
}

.when a {
  color: #38bdf8;
  text-decoration: none;
}

.when a:hover {
  text-decoration: underline;
}

/* Styled to match the campsite cards on the trip page, so the same site
   looks the same in both places. */
.score {
  grid-area: score;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #a3e635;
  white-space: nowrap;
  text-align: right;
  min-width: 4.5rem;
}

.value {
  display: inline-block;
  min-width: 1.9rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.ratings .value {
  min-width: 1.6rem;
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

/* Five explicit columns, so every row's icons line up down the page. */
.ratings {
  grid-area: ratings;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(3.5rem, auto));
  gap: 0.5rem 1rem;
}

/* Under the name on a phone, and three to a row once five would squeeze each
   "1.5/2" onto two lines — the same 3-and-2 break as the trip page's cards,
   measured against the card rather than the viewport. */
@media (max-width: 48rem) {
  .site {
    container-type: inline-size;
  }

  .ratings {
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem 1rem;
  }

  @container (min-width: 24rem) {
    .ratings {
      grid-template-columns: repeat(5, 1fr);
    }
  }
}

.ratings > div {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.ratings dt {
  display: flex;
}

.ratings dd {
  margin: 0;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.unrated-head {
  margin: 2rem 0 0.75rem;
  font-size: 1.1rem;
}

.legend {
  list-style: none;
  margin: 1.5rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  color: #64748b;
  font-size: 0.75rem;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
</style>
