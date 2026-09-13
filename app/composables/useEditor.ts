// Who is looking at this page.
//
// Access gates paths at the edge, so it never runs on a public page — the page
// has no identity in its request. This asks the server instead, and the server
// answers from the Access cookie the browser still sends.
//
// Deliberately client-only. Rendering editor controls into the server response
// would put editor-flavoured HTML into a response that a cache could hand to
// the next anonymous visitor. The cost is that the controls appear a moment
// after hydration rather than in the first paint.
export function useEditor() {
  const state = useState<{ email: string | null; editor: boolean }>('editor', () => ({
    email: null,
    editor: false,
  }))

  const pending = useState('editor-pending', () => false)

  async function refresh() {
    if (import.meta.server || pending.value) return
    pending.value = true
    try {
      state.value = await $fetch('/api/me')
    } catch {
      // A network failure means "unknown", which renders the same as "no".
      state.value = { email: null, editor: false }
    } finally {
      pending.value = false
    }
  }

  onMounted(refresh)

  return {
    email: computed(() => state.value.email),
    isEditor: computed(() => state.value.editor),
    refresh,
  }
}
