<script setup lang="ts">
useHead({
  title: 'Sign in — Kayak Trips',
})

const supabase = useSupabaseClient()
const session = useSupabaseSession()
const redirectInfo = useSupabaseCookieRedirect()

const email = ref('')
const password = ref('')
const pending = ref(false)
const errorMessage = ref('')

// Fires both when sign-in succeeds and when someone with a live session
// lands here directly. `pluck` returns them to the page they were gated
// out of, falling back to the only editable page we have so far.
watch(
  session,
  (value) => {
    if (value) navigateTo(redirectInfo.pluck() || '/upload')
  },
  { immediate: true },
)

async function signIn() {
  pending.value = true
  errorMessage.value = ''

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  if (error) {
    pending.value = false
    errorMessage.value = error.message
  }
}
</script>

<template>
  <main class="wrap">
    <NuxtLink class="back" to="/">&larr; Back</NuxtLink>
    <h1>Sign in</h1>
    <p class="lede">
      Editor access only. Accounts are created by hand &mdash; there's no
      sign-up.
    </p>

    <form class="card" @submit.prevent="signIn">
      <label>
        <span>Email</span>
        <input v-model="email" type="email" required autocomplete="username" />
      </label>

      <label>
        <span>Password</span>
        <input
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
        />
      </label>

      <button type="submit" :disabled="pending">
        {{ pending ? 'Signing in…' : 'Sign in' }}
      </button>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </form>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 24rem;
  margin: 0 auto;
  padding: 2rem;
}

.back {
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.9rem;
}

h1 {
  margin: 1rem 0 0.5rem;
}

.lede {
  color: #94a3b8;
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.card {
  background: #1e293b;
  border-radius: 0.75rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}

label span {
  color: #94a3b8;
}

input {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.4rem;
  padding: 0.6rem 0.7rem;
  color: #e2e8f0;
  font-size: 1rem;
}

input:focus {
  outline: 2px solid #38bdf8;
  outline-offset: 1px;
}

button {
  background: #38bdf8;
  color: #0f172a;
  font-weight: 600;
  border: none;
  border-radius: 0.5rem;
  padding: 0.65rem 1.25rem;
  cursor: pointer;
  font-size: 1rem;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: #f87171;
  margin: 0;
  font-size: 0.9rem;
}
</style>
