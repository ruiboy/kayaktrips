<script setup lang="ts">
// The only always-visible answer to "am I signed in?". Before this, the sole
// indicator anywhere was the email on /upload, so being signed out was
// indistinguishable from the app simply having no editing — and in the
// installed PWA there is no address bar to type a URL into, which made
// signing in impossible rather than merely obscure.
//
// Both links below are plain anchors on purpose. Access works at the edge, so
// it only sees a real navigation; a client-side route change would never reach
// it and the login would silently not happen.
const { email, isEditor } = useEditor()

// Signing in means visiting a path Access protects and letting it challenge.
// /signin exists only to be that path: it has nothing on it, and it sends you
// back where you were. Pointing this at /upload also worked, but landing on an
// upload form when you asked to sign in reads as a wrong turn.
const route = useRoute()
const signInHref = computed(
  () => `/signin?next=${encodeURIComponent(route.fullPath)}`,
)

// Access owns the session cookie, so only Access can clear it.
const SIGN_OUT = '/cdn-cgi/access/logout'
</script>

<template>
  <div class="account">
    <!-- The address is not shown. It said nothing you didn't know — you are
         the one signed in — and on a narrow screen it pushed the nav onto a
         third row. The title still carries it for the rare "which account?". -->
    <a v-if="isEditor" class="link" :href="SIGN_OUT" :title="`Signed in as ${email}`">
      Sign out
    </a>

    <a v-else class="link" :href="signInHref">Sign in</a>
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
