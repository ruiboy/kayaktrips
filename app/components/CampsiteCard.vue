<script setup lang="ts">
// One campsite, the same wherever it appears: in a trip's list and in the
// ranking across every trip. Editing stays with whoever owns the dialog, so
// this only says that the pencil was pressed.
defineProps<{
  site: Campsite
  // Named on the Campsites page, where nothing else says which trip a night
  // belongs to. On the trip page it would only repeat the heading.
  trip?: { slug: string; title: string }
  editable?: boolean
}>()

defineEmits<{ edit: [] }>()

function ratingText(value: number | null) {
  return value === null ? '—' : String(value)
}
</script>

<template>
  <article class="card">
    <div class="site-head">
      <div>
        <h3>{{ site.name }}</h3>
        <p class="when">
          <template v-if="trip">
            <NuxtLink :to="`/trips/${trip.slug}`">{{ trip.title }}</NuxtLink>
            &middot;
          </template>
          <span class="date">{{ formatDay(site.camped_on) }}</span>
        </p>
      </div>
      <p class="score">
        <template v-if="site.score !== null">
          <span class="value">{{ site.score }}</span
          ><span class="out-of">/10</span>
        </template>
        <span v-else class="unrated">Unrated</span>
      </p>
    </div>

    <p v-if="site.notes" class="notes">{{ site.notes }}</p>

    <dl class="ratings">
      <div v-for="rating in RATINGS" :key="rating.key">
        <dt><RatingIcon :name="rating.key" :label="rating.label" /></dt>
        <dd>
          <span class="value">{{ ratingText(site[rating.key]) }}</span
          ><span class="out-of">/2</span>
        </dd>
      </div>
    </dl>

    <!-- Coordinates and the pencil share the last line, so the card ends
         on one row rather than leaving a control adrift beneath it. The row
         is rendered whenever either half has something to show. -->
    <div
      v-if="editable || (site.lat !== null && site.lon !== null)"
      class="site-foot"
    >
      <p v-if="site.lat !== null && site.lon !== null" class="coords">
        {{ site.lat }}, {{ site.lon }}
      </p>
      <EditButton
        v-if="editable"
        :label="`Edit ${site.name}`"
        @click="$emit('edit')"
      />
    </div>
  </article>
</template>

<style scoped>
.card {
  height: 100%;
  background: #1e293b;
  border-radius: 0.75rem;
  padding: 1.25rem;
  /* The card is what the ratings grid measures itself against. */
  container-type: inline-size;
}

.site-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.site-head h3 {
  margin: 0;
  font-size: 1rem;
}

.when {
  margin: 0.15rem 0 0;
  color: #94a3b8;
  font-size: 0.85rem;
}

/* Wraps whole, so a narrow card breaks after the trip name rather than
   leaving "Sept 2012" stranded on a line of its own. */
.date {
  white-space: nowrap;
}

.when a {
  color: #38bdf8;
  text-decoration: none;
}

.when a:hover {
  text-decoration: underline;
}

/* A fixed footprint so the block is the same size on every card whatever the
   score, with room between it and a long campsite name. */
.score {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #a3e635;
  white-space: nowrap;
  flex: 0 0 auto;
  min-width: 5rem;
  padding-left: 1rem;
  text-align: right;
}

/* A fixed box for the number so a 5 and a 6.5 take the same room, and the
   "/10" and "/2" sit at the same offset on every card instead of sliding
   with the digit count. */
.value {
  display: inline-block;
  min-width: 1.9rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Right-aligned, so "1" and "1.5" both sit against their "/2" and the slack
   falls after the icon. Left-aligned the number floats away from the
   denominator and the pair stops reading as one figure. */
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

.notes {
  margin: 0.75rem 0 0;
  line-height: 1.5;
  white-space: pre-wrap;
}

/* Explicit columns rather than wrapping. Left to wrap, a 1.5 being wider than
   a 1 broke one campsite 3-and-2 and the next 4-and-1; and even at a fixed
   width, wrapping gives you 4-and-1 at any width where four happen to fit.
   Three columns can only ever break 3-and-2, which is the fallback anywhere
   container queries aren't supported. */
.ratings {
  margin: 1rem 0 0;
  display: grid;
  /* `1fr` rather than a fixed width, so the row fills the card. Still an
     explicit column count: three can only break 3-and-2, never 4-and-1, and
     the columns line up between the two rows when it does. */
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem 1rem;
}

/* 5 × 4rem + 4 × 1rem of gap. Measured against the card, not the viewport —
   the card sits in columns whose width the viewport alone doesn't tell you. */
@container (min-width: 24rem) {
  .ratings {
    grid-template-columns: repeat(5, 1fr);
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

.coords {
  margin: 0.75rem 0 0;
  color: #64748b;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

/* Coordinates left, pencil hard right, on the card's last line. */
.site-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.5rem;
  min-height: 1.75rem;
}
</style>
