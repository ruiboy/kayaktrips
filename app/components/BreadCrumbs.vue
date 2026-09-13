<script setup lang="ts">
// One trail, used on every page below the landing page. It replaces the
// assorted "← Back" and "← All trips" links, which each guessed at where you
// had come from and disagreed with each other.
//
// The trail is the site's shape, not your history: /trips/<slug> always says
// Home / Trips / <title>, whether you arrived from the trips list, the map, or
// a link someone sent you. Browser back still does history.
export type Crumb = { label: string; to?: string }

defineProps<{ trail: Crumb[] }>()
</script>

<template>
  <nav class="crumbs" aria-label="Breadcrumb">
    <ol>
      <li v-for="(crumb, index) in trail" :key="index">
        <NuxtLink v-if="crumb.to" :to="crumb.to">{{ crumb.label }}</NuxtLink>
        <!-- The last crumb is where you are, so it isn't a link. -->
        <span v-else aria-current="page">{{ crumb.label }}</span>
        <span v-if="index < trail.length - 1" class="sep" aria-hidden="true">/</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.crumbs ol {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  font-size: 0.9rem;
}

.crumbs li {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  min-width: 0;
}

a {
  color: #38bdf8;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

span[aria-current] {
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sep {
  color: #475569;
}
</style>
