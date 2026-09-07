<script setup lang="ts">
useHead({
  title: 'Kayak Trips',
})
</script>

<template>
  <main class="hero">
    <div class="corner">
      <AccountControl />
    </div>

    <div class="hero-inner">
      <div class="badge">
        <img
          src="/mkt-crew.png"
          width="960"
          height="948"
          alt="Mega Kayak Trip Crew badge: a kayak on the river, paddles crossed over a campfire"
        />
      </div>

      <div class="copy">
        <p class="eyebrow">Kayak Trips</p>
        <h1>Every put-in, campsite, and paddle &mdash; in one place.</h1>
        <p class="lede">
          For the trips we've paddled: the water, the campsites, the photos
          that came back with us.
        </p>
        <div class="actions">
          <NuxtLink class="cta" to="/trips">See the trips &rarr;</NuxtLink>
          <NuxtLink class="cta cta-quiet" to="/photos">See the photos &rarr;</NuxtLink>
          <NuxtLink class="cta cta-quiet" to="/maps">See the maps &rarr;</NuxtLink>
        </div>

        <InstallButton class="install-slot" />
      </div>
    </div>
  </main>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

/* The hero is vertically centred, so there's no top row to sit in — but this
   is the page an installed app opens on, and it's where you need the way in. */
.corner {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
}

.hero-inner {
  display: flex;
  align-items: center;
  gap: clamp(2rem, 5vw, 4rem);
  max-width: 58rem;
}

/* The crew badge is a shield, not a disc, and its background has been cut out
   — so no circular mask and no overscale, both of which would clip the
   lettering and the paddle tips. The shadow follows the artwork's own edge
   rather than a box. */
.badge {
  flex: 0 0 auto;
  width: clamp(11rem, 26vw, 18rem);
}

.badge img {
  width: 100%;
  height: auto;
  display: block;
  filter: drop-shadow(0 1rem 1.75rem rgb(0 0 0 / 0.55));
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

.install-slot {
  display: block;
  margin-top: 1.5rem;
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
