<script setup lang="ts">
// Who was on this trip, and the one control that puts you among them.
//
// The row is public and deliberately quiet: initials, nothing else. There is no
// name behind them and no avatar — a trip's photos are what it looks like, and
// this is only meant to answer "who was on that one?" for someone who already
// knows the crew.
const props = defineProps<{
  tripId: string
  // As the trip page loaded them. Held rather than read straight through, so a
  // click shows immediately instead of waiting on a refetch.
  attendees: string[]
}>()

const { isEditor, initials } = useEditor()
const { was, refresh, remember } = useAttendance()

const here = ref<string[]>([...props.attendees])
watch(
  () => props.attendees,
  (next) => {
    here.value = [...next]
  },
)

const saving = ref(false)
const message = ref('')

onMounted(refresh)

const iWasThere = computed(() => was(props.tripId))

// Only for someone the registry knows: an editor without a row has no initials
// to add, and a button that can only fail is worse than no button. The owner
// adds them alongside the Access policy.
const canMark = computed(() => isEditor.value && initials.value !== null)

async function toggle() {
  const mine = initials.value
  if (!mine || saving.value) return

  const leaving = iWasThere.value
  saving.value = true
  message.value = ''

  try {
    if (leaving) {
      await $fetch(`/api/attendance/${props.tripId}`, { method: 'DELETE' })
      here.value = here.value.filter((entry) => entry !== mine)
    } else {
      await $fetch('/api/attendance', {
        method: 'POST',
        body: { trip_id: props.tripId },
      })
      // Sorted the way the server returns them, so the row doesn't reorder
      // itself on the next load.
      here.value = [...here.value, mine].sort()
    }
    remember(props.tripId, !leaving)
  } catch (error) {
    message.value =
      (error as { statusCode?: number })?.statusCode === 401
        ? 'That was refused. Are you still signed in?'
        : ((error as { statusMessage?: string })?.statusMessage ?? "That didn't save.")
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- Nothing at all on a trip nobody has marked, unless you are the one who
       could mark it. Silence is the right answer for a reader. -->
  <p v-if="here.length || canMark" class="who">
    <span v-for="entry in here" :key="entry" class="initial">{{ entry }}</span>

    <!-- Outlined and grey in both states, never filled: your initial in the row
         is what says you were there, and a control that announces it a second
         time is the loudest thing on a line meant to be quiet. The mark changes,
         the volume doesn't. -->
    <button
      v-if="canMark"
      class="mark"
      :aria-pressed="iWasThere"
      :disabled="saving"
      @click="toggle"
    >
      {{ iWasThere ? '✓ You were there' : '+ Add me' }}
    </button>

    <span v-if="message" class="error">{{ message }}</span>
  </p>
</template>

<style scoped>
.who {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.6rem 0 0;
}

/* A letter in a ring rather than a filled disc: the account control already
   uses a filled disc for "you", and these are other people. */
.initial {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6rem;
  height: 1.6rem;
  padding: 0 0.35rem;
  border: 1px solid #334155;
  border-radius: 999px;
  color: #94a3b8;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
}

/* The same ring the initials wear, stretched to fit a couple of words — so it
   sits in the row rather than beside it. */
.mark {
  margin-left: 0.25rem;
  background: none;
  border: 1px solid #334155;
  border-radius: 999px;
  color: #64748b;
  font: inherit;
  font-size: 0.75rem;
  padding: 0 0.7rem;
  height: 1.6rem;
  cursor: pointer;
}

/* The only colour it ever takes is on hover, where it is answering a question
   the reader has just asked by pointing at it. */
.mark:hover:not(:disabled) {
  border-color: #38bdf8;
  color: #38bdf8;
}

.mark:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: #fca5a5;
  font-size: 0.8rem;
}
</style>
