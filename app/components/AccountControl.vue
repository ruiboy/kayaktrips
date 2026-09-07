<script setup lang="ts">
// The only always-visible answer to "am I signed in?". Before this, the sole
// indicator anywhere was the email on /upload, so being signed out was
// indistinguishable from the app simply having no editing — and in the
// installed PWA there is no address bar to type /login into, which made
// signing in impossible rather than merely obscure.
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()

async function signOut() {
  await supabase.auth.signOut()
  await navigateTo('/')
}
</script>

<template>
  <div class="account">
    <template v-if="user">
      <span class="who">{{ user.email }}</span>
      <button class="link" @click="signOut">Sign out</button>
    </template>

    <!-- Carries where you were, so signing in returns you here rather than
         dumping you on /upload. Nuxt's own redirect cookie only gets set when
         a gated route bounces you, which isn't what happened here. -->
    <NuxtLink
      v-else
      class="link"
      :to="{ path: '/login', query: { next: route.fullPath } }"
    >
      Sign in
    </NuxtLink>
  </div>
</template>

<style scoped>
.account {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  font-size: 0.85rem;
}

.who {
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 11rem;
}

.link {
  flex: 0 0 auto;
  background: none;
  border: 1px solid #334155;
  color: #94a3b8;
  border-radius: 0.35rem;
  padding: 0.25rem 0.6rem;
  font: inherit;
  font-size: 0.8rem;
  text-decoration: none;
  cursor: pointer;
}

.link:hover {
  border-color: #38bdf8;
  color: #38bdf8;
}
</style>
