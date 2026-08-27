<script setup lang="ts">
useHead({
  title: 'Kayak Trips',
})
</script>

<template>
  <main class="hero">
    <div class="hero-inner">
      <div class="badge">
        <img
          src="/mkt-badge.jpg"
          width="640"
          height="640"
          alt="Mega Kayak Trip X badge: Lock 9 to Customs House, established 2012"
        />
      </div>

      <div class="copy">
        <p class="eyebrow">Kayak Trips</p>
        <h1>Every put-in, campsite, and paddle &mdash; in one place.</h1>
        <p class="lede">
          This is the earliest cut of the app: a proof of concept to show the
          planned stack (Nuxt, Supabase, deployed as an installable PWA) is
          working end to end. Maps, trip logs, and full accounts come next.
        </p>
        <div class="actions">
          <NuxtLink class="cta" to="/photos">See the photos &rarr;</NuxtLink>
          <NuxtLink class="cta cta-quiet" to="/upload">Upload one</NuxtLink>
        </div>
      </div>
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
  display: flex;
  align-items: center;
  gap: clamp(2rem, 5vw, 4rem);
  max-width: 58rem;
}

.badge {
  flex: 0 0 auto;
  width: clamp(11rem, 26vw, 18rem);
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 1.25rem 2.5rem rgb(0 0 0 / 0.45);
}

.badge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  /* Slight overscale hides the benchtop the sticker was photographed on,
     which would otherwise show as a sliver at the circular edge. */
  transform: scale(1.03);
}

.copy {
  min-width: 0;
}

@media (max-width: 40rem) {
  .hero-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 2rem;
  }
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

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.cta-quiet {
  background: none;
  color: #38bdf8;
  border: 1px solid #334155;
}

.cta-quiet:hover {
  background: none;
  border-color: #38bdf8;
}
</style>
