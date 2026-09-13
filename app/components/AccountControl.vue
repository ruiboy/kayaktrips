<script setup lang="ts">
// The only always-visible answer to "am I signed in?". Before this, the sole
// indicator anywhere was the email on /upload, so being signed out was
// indistinguishable from the app simply having no editing — and in the
// installed PWA there is no address bar to type a URL into, which made signing
// in impossible rather than merely obscure.
//
// Signed in it is an initial in a disc, opening a menu with the address and the
// way out. That replaced a bare "Sign out" button, which spent the widest thing
// in the top row on the action you want least often, and a visible email
// address before that, which pushed the nav onto a third row on a phone.
//
// Both links are plain anchors on purpose. Access works at the edge, so it only
// sees a real navigation; a client-side route change would never reach it and
// the login would silently not happen.
const { email, isEditor } = useEditor()

// Signing in means visiting a path Access protects and letting it challenge.
// /signin exists only to be that path: it has nothing on it, and it sends you
// back where you were.
const route = useRoute()
const signInHref = computed(
  () => `/signin?next=${encodeURIComponent(route.fullPath)}`,
)

// Access owns the session cookie, so only Access can clear it.
const SIGN_OUT = '/cdn-cgi/access/logout'

const initial = computed(() => (email.value?.[0] ?? '?').toUpperCase())

const open = ref(false)
const root = ref<HTMLElement | null>(null)

// Light dismiss, which a menu needs and no element gives for free at a usable
// position: <dialog> is modal and <details> ignores clicks elsewhere. Listening
// while open rather than always keeps this off every other click on the page.
function onDocumentClick(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('click', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="account">
    <template v-if="isEditor">
      <button
        class="avatar"
        type="button"
        :aria-expanded="open"
        aria-haspopup="menu"
        :aria-label="`Account: ${email}`"
        @click="open = !open"
      >
        {{ initial }}
      </button>

      <div v-if="open" class="menu" role="menu">
        <p class="who">{{ email }}</p>
        <a class="out" :href="SIGN_OUT" role="menuitem">Sign out</a>
      </div>
    </template>

    <a v-else class="link" :href="signInHref">Sign in</a>
  </div>
</template>

<style scoped>
.account {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  font-size: 0.85rem;
}

.avatar {
  width: 1.9rem;
  height: 1.9rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #334155;
  border: 1px solid #475569;
  color: #e2e8f0;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.avatar:hover,
.avatar[aria-expanded='true'] {
  border-color: #38bdf8;
  color: #38bdf8;
}

/* Right-aligned: it hangs off the end of the top row, and a left-aligned menu
   would run off a narrow screen. */
.menu {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  z-index: 20;
  min-width: max-content;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 0.6rem 0.75rem;
  box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 0.45);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.who {
  margin: 0;
  color: #94a3b8;
  font-size: 0.8rem;
  white-space: nowrap;
}

.out,
.link {
  color: #38bdf8;
  text-decoration: none;
  white-space: nowrap;
}

.out {
  border-top: 1px solid #334155;
  padding-top: 0.5rem;
}

.out:hover,
.link:hover {
  text-decoration: underline;
}

.link {
  border: 1px solid #334155;
  border-radius: 0.35rem;
  padding: 0.25rem 0.6rem;
  color: #94a3b8;
  font-size: 0.8rem;
}

.link:hover {
  border-color: #38bdf8;
  color: #38bdf8;
  text-decoration: none;
}
</style>
