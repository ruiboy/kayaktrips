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

// Signing in means visiting a path Access protects and letting it challenge —
// there is no login page of our own any more. /upload is that path, and Access
// returns you to it once the code is accepted.
const SIGN_IN = '/upload'

// Access owns the session cookie, so only Access can clear it.
const SIGN_OUT = '/cdn-cgi/access/logout'
</script>

<template>
  <div class="account">
    <template v-if="isEditor">
      <span class="who">{{ email }}</span>
      <a class="link" :href="SIGN_OUT">Sign out</a>
    </template>

    <a v-else class="link" :href="SIGN_IN">Sign in</a>
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
