// `beforeinstallprompt` can fire before any component mounts, so it's captured
// here rather than in the button — miss the event and the button never appears.
export default defineNuxtPlugin(() => {
  const prompt = useState<BeforeInstallPromptEvent | null>(
    'pwa-install-prompt',
    () => null,
  )

  window.addEventListener('beforeinstallprompt', (event) => {
    // Chrome shows its own mini-infobar unless this is prevented.
    event.preventDefault()
    prompt.value = event as BeforeInstallPromptEvent
  })

  window.addEventListener('appinstalled', () => {
    prompt.value = null
  })
})
