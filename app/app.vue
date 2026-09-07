<template>
  <div class="page">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<style>
:root {
  color-scheme: dark;
}

/* For in-page jumps like the trip page's link down to its map. Gated on the
   motion preference — a long smooth scroll is exactly what that setting is for. */
@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #0f172a;
  color: #e2e8f0;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}

.page {
  min-height: 100vh;
}
</style>
