<script setup lang="ts">
useHead({
  title: 'New trip — Kayak Trips',
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const title = ref('')
const startDate = ref('')
const endDate = ref('')
const startPlace = ref('')
const endPlace = ref('')
const notes = ref('')

const pending = ref(false)
const errorMessage = ref('')

const slug = computed(() => slugify(title.value))

// Shown live under the date fields so "6 days" is something you can check
// rather than something you have to trust the arithmetic on.
const dayCount = computed(() => {
  if (!startDate.value || !endDate.value) return null
  const days = tripDayCount(startDate.value, endDate.value)
  return days > 0 ? days : null
})

const datesBackwards = computed(
  () => Boolean(startDate.value && endDate.value && endDate.value < startDate.value),
)

const canSubmit = computed(
  () =>
    Boolean(slug.value && startDate.value && endDate.value) &&
    !datesBackwards.value &&
    !pending.value,
)

async function createTrip() {
  if (!canSubmit.value) return

  pending.value = true
  errorMessage.value = ''

  // Same shape as the upload page: `useSupabaseUser` hands back the decoded
  // JWT, so the id is `sub` and a wrong claim name would silently be undefined.
  const authorId = user.value?.sub
  if (!authorId) {
    pending.value = false
    errorMessage.value = 'Not signed in — reload the page and try again.'
    return
  }

  const { error } = await supabase.from('trips').insert({
    slug: slug.value,
    title: title.value.trim(),
    start_date: startDate.value,
    end_date: endDate.value,
    start_place: startPlace.value.trim() || null,
    end_place: endPlace.value.trim() || null,
    notes: notes.value.trim() || null,
    created_by: authorId,
  })

  if (error) {
    pending.value = false
    // The slug is derived from the title, so a unique violation means the
    // title collides — say that rather than leaking the constraint name.
    errorMessage.value =
      error.code === '23505'
        ? `There's already a trip called “${title.value.trim()}”.`
        : error.message
    return
  }

  await navigateTo(`/trips/${slug.value}`)
}
</script>

<template>
  <main class="wrap">
    <div class="topbar">
      <NuxtLink class="back" to="/trips">&larr; All trips</NuxtLink>
      <AccountControl />
    </div>
    <h1>New trip</h1>
    <p class="lede">Where you put in, where you took out, and how long it took.</p>

    <form class="card" @submit.prevent="createTrip">
      <label>
        <span>Title</span>
        <input
          v-model="title"
          type="text"
          maxlength="120"
          required
          placeholder="Mega Kayak Trip X"
        />
        <em v-if="slug" class="hint">/trips/{{ slug }}</em>
      </label>

      <div class="pair">
        <label>
          <span>Put in</span>
          <input v-model="startDate" type="date" required />
        </label>
        <label>
          <span>Take out</span>
          <input v-model="endDate" type="date" required />
        </label>
      </div>

      <p v-if="datesBackwards" class="error">The take-out is before the put-in.</p>
      <p v-else-if="dayCount" class="derived">
        {{ dayCount }} {{ dayCount === 1 ? 'day' : 'days' }} on the water.
      </p>

      <div class="pair">
        <label>
          <span>From <em>(optional)</em></span>
          <input v-model="startPlace" type="text" maxlength="120" placeholder="Lock 9" />
        </label>
        <label>
          <span>To <em>(optional)</em></span>
          <input
            v-model="endPlace"
            type="text"
            maxlength="120"
            placeholder="Customs House"
          />
        </label>
      </div>

      <label>
        <span>Notes <em>(optional)</em></span>
        <textarea v-model="notes" rows="3" maxlength="2000" />
      </label>

      <button type="submit" :disabled="!canSubmit">
        {{ pending ? 'Creating…' : 'Create trip' }}
      </button>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </form>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 34rem;
  margin: 0 auto;
  padding: 2rem;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
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

label > span {
  color: #94a3b8;
}

label em {
  font-style: normal;
  color: #64748b;
}

input,
textarea {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.4rem;
  padding: 0.6rem 0.7rem;
  color: #e2e8f0;
  font-size: 1rem;
  font-family: inherit;
  width: 100%;
}

input:focus,
textarea:focus {
  outline: 2px solid #38bdf8;
  outline-offset: 1px;
}

textarea {
  resize: vertical;
}

.pair {
  display: flex;
  gap: 1rem;
}

.pair label {
  flex: 1;
  min-width: 0;
}

@media (max-width: 30rem) {
  .pair {
    flex-direction: column;
  }
}

.hint {
  font-style: normal;
  color: #64748b;
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}

.derived {
  margin: -0.25rem 0 0;
  color: #38bdf8;
  font-size: 0.85rem;
}

button {
  background: #38bdf8;
  color: #0f172a;
  font-weight: 600;
  border: none;
  border-radius: 0.5rem;
  padding: 0.65rem 1.25rem;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: #f87171;
  margin: 0;
}
</style>
