<script setup lang="ts">
const prompt = useState<BeforeInstallPromptEvent | null>(
  'pwa-install-prompt',
  () => null,
)

const isIOS = ref(false)
const isInstalled = ref(false)
const mounted = ref(false)

onMounted(() => {
  const ua = navigator.userAgent

  // iOS never fires `beforeinstallprompt` — Apple ships no install API — so it
  // needs Share-sheet instructions rather than a button that can't do anything.
  // iPadOS 13+ reports itself as "Macintosh", hence the touch-point check.
  isIOS.value =
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)

  isInstalled.value =
    window.matchMedia('(display-mode: standalone)').matches ||
    // Non-standard, iOS Safari only.
    (navigator as { standalone?: boolean }).standalone === true

  mounted.value = true
})

// `beforeinstallprompt` is Chromium-only, so Firefox and desktop Safari fire
// nothing and used to be shown nothing — the app looked as though it simply
// wasn't installable. They can still install it, just from a menu.
//
// The prompt can also arrive after mount, and Chromium suppresses it for a
// while after an uninstall, so a Chromium browser can sit in this state too.
// Generic wording covers all of them.
const mode = computed(() => {
  if (!mounted.value || isInstalled.value) return 'none'
  if (prompt.value) return 'prompt'
  return isIOS.value ? 'ios' : 'menu'
})

async function install() {
  if (!prompt.value) return

  await prompt.value.prompt()
  const { outcome } = await prompt.value.userChoice

  if (outcome === 'accepted') isInstalled.value = true
  // The event is single-use either way.
  prompt.value = null
}
</script>

<template>
  <!-- Nothing to show once it's already installed. -->
  <div v-if="mode !== 'none'" class="install">
    <button v-if="mode === 'prompt'" class="install-link" @click="install">
      Add this to your home screen
    </button>

    <p v-else-if="mode === 'ios'" class="hint">
      To add this to your home screen: tap
      <strong>Share</strong> then <strong>Add to Home Screen</strong>.
    </p>

    <p v-else class="hint">
      To add this to your home screen, open your browser's menu and choose
      <strong>Install</strong> or <strong>Add to Home screen</strong>.
    </p>
  </div>
</template>

<style scoped>
/* Deliberately not a button: installing is an aside to the page, and a third
   filled control next to the two CTAs read as more important than it is. It
   matches the iOS hint below so both platforms get the same quiet register. */
.install-link {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #94a3b8;
  text-decoration: underline;
  text-decoration-color: #334155;
  text-underline-offset: 0.25em;
  cursor: pointer;
}

.install-link:hover {
  color: #38bdf8;
  text-decoration-color: #38bdf8;
}

.hint {
  margin: 0;
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1.5;
}

.hint strong {
  color: #94a3b8;
  font-weight: 600;
}
</style>
