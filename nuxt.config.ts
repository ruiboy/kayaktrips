// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/supabase', '@vite-pwa/nuxt'],

  app: {
    head: {
      // @vite-pwa/nuxt serves the manifest but does not link it from the page.
      // Without this the browser never discovers the app is installable, so
      // `beforeinstallprompt` never fires and no install affordance appears.
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/icon-192.png' },
      ],
      meta: [
        { name: 'theme-color', content: '#0f172a' },
        // iOS ignores the manifest; these drive the home-screen behaviour.
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Kayak Trips' },
        {
          name: 'apple-mobile-web-app-status-bar-style',
          content: 'black-translucent',
        },
      ],
    },
  },

  supabase: {
    // Only `include` paths require a session — everything else stays public,
    // which is the whole point: public read, gated editing.
    redirect: true,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      include: ['/upload'],
      saveRedirectToCookie: true,
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Kayak Trips',
      short_name: 'KayakTrips',
      description: 'Track kayak trips, campsites, and photos',
      theme_color: '#0f172a',
      background_color: '#0f172a',
      display: 'standalone',
      icons: [
        {
          src: 'icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
    },
    devOptions: {
      enabled: true,
    },
  },
})
