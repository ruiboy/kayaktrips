<script setup lang="ts">
const prompt = useState<BeforeInstallPromptEvent | null>(
  'pwa-install-prompt',
  () => null,
)

const isIOS = ref(false)
const isInstalled = ref(false)

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
  <!-- Nothing to show once installed, or in browsers with no install path. -->
  <div v-if="!isInstalled && (prompt || isIOS)" class="install">
    <button v-if="prompt" @click="install">Add to home screen</button>

    <p v-else class="ios-hint">
      To add this to your home screen: tap
      <strong>Share</strong> then <strong>Add to Home Screen</strong>.
    </p>
  </div>
</template>

<style scoped>
.install button {
  background: none;
  border: 1px solid #334155;
  color: #38bdf8;
  font: inherit;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
}

.install button:hover {
  border-color: #38bdf8;
}

.ios-hint {
  margin: 0;
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1.5;
}

.ios-hint strong {
  color: #94a3b8;
  font-weight: 600;
}
</style>
