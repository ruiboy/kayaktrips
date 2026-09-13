<script setup lang="ts">
// A door, not a page. Access gates this path, so simply arriving here means
// the challenge has already been passed — there is nothing to sign in *with*
// and nothing to render for long.
//
// It exists because the alternative was pointing "Sign in" at /upload, which
// worked but read as "why am I being asked to upload something?".
useHead({ title: 'Signing in — Kayak Trips' })

const route = useRoute()
const { refresh } = useEditor()

// Where the user was when they clicked. Only internal paths are honoured — an
// absolute URL here would turn this into an open redirect, and it is a page
// anyone can reach.
const next = computed(() => {
  const raw = String(route.query.next ?? '/')
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
})

onMounted(async () => {
  await refresh()
  await navigateTo(next.value, { replace: true })
})
</script>

<template>
  <main class="signing-in">
    <p>Signing you in&hellip;</p>
    <NuxtLink :to="next">Continue</NuxtLink>
  </main>
</template>

<style scoped>
.signing-in {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: #94a3b8;
}

a {
  color: #38bdf8;
}
</style>
