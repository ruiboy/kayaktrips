<script setup lang="ts">
useHead({
  title: 'Campsites — Kayak Trips',
})

type RankedCampsite = Campsite & {
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

    <template v-else>
      <!-- The same card as the trip page, read-only here: editing a campsite
           needs its trip's dates and map, which live on the trip page the
           card links to. Unrated sites come last, from the route's ordering. -->
      <ol class="list">
        <li v-for="site in campsites" :key="site.id">
          <CampsiteCard
            :site="site"
            :trip="{ slug: site.trip_slug, title: site.trip_title }"
          />
        </li>
      </ol>

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

/* Cards side by side, filling rows left to right in rank order, and one
   column on a phone. 26rem keeps each card wide enough for its five ratings
   to sit on one line. */
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(26rem, 100%), 1fr));
  gap: 0.75rem;
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
