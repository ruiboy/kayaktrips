<script setup lang="ts">
useHead({
  title: 'Kayak Trips',
})
</script>

<template>
  <main class="hero">
    <div class="hero-inner">
      <p class="eyebrow">Kayak Trips</p>
      <h1>Every put-in, campsite, and paddle &mdash; in one place.</h1>
      <p class="lede">
        This is the earliest cut of the app: a proof of concept to show the
        planned stack (Nuxt, Supabase, deployed as an installable PWA) is
        working end to end. Maps, trip logs, and full accounts come next.
      </p>
      <NuxtLink class="cta" to="/upload">Try the photo upload &rarr;</NuxtLink>
    </div>
  </main>
</template>

<style scoped>
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.hero-inner {
  max-width: 36rem;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #38bdf8;
  margin: 0 0 0.75rem;
}

h1 {
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  line-height: 1.15;
  margin: 0 0 1rem;
}

.lede {
  color: #94a3b8;
  line-height: 1.6;
  margin: 0 0 2rem;
}

.cta {
  display: inline-block;
  background: #38bdf8;
  color: #0f172a;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  text-decoration: none;
}

.cta:hover {
  background: #7dd3fc;
}
</style>
