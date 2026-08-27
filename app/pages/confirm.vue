<script setup lang="ts">
// Landing point for Supabase auth callbacks. Password sign-in never routes
// here, but the module's `redirectOptions.callback` must resolve to a real
// page — and this is where OAuth or a future password-reset link would land.
useHead({
  title: 'Signing in — Kayak Trips',
})

const session = useSupabaseSession()
const redirectInfo = useSupabaseCookieRedirect()

watch(
  session,
  (value) => {
    if (value) navigateTo(redirectInfo.pluck() || '/upload')
  },
  { immediate: true },
)
</script>

<template>
  <main class="wrap">
    <p>Signing you in&hellip;</p>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 24rem;
  margin: 0 auto;
  padding: 2rem;
  color: #94a3b8;
}
</style>
