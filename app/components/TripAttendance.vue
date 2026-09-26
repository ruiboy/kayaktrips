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

// Both button states answer the section's label rather than restating it, so
// the line reads as one sentence. Two words out of context are not much for a
// screen reader, so the full phrasing lives in the accessible name.
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
    <!-- Named, now it sits at the foot with no heading above it to say what a
         row of letters is. -->
    <span class="label">Who was there:</span>

    <span v-for="entry in here" :key="entry" class="initial">{{ entry }}</span>

    <!-- Outlined and grey in both states, never filled: your initial in the row
         is what says you were there, and a control that announces it a second
         time is the loudest thing on a line meant to be quiet. The mark changes,
         the volume doesn't. -->
    <button
      v-if="canMark"
      class="mark"
      :aria-pressed="iWasThere"
      :aria-label="
        iWasThere
          ? 'You were on this trip — press to remove yourself'
          : 'Add yourself to this trip'
      "
      :disabled="saving"
      @click="toggle"
    >
      {{ iWasThere ? '✓ I was' : '+ Add me' }}
    </button>

    <span v-if="message" class="error">{{ message }}</span>
  </p>
</template>

<style scoped>
/* At the foot, under both columns, hugging its contents and centred: full width
   made a band out of something that is one short line, and the emptiness either
   side of the words was the loudest thing about it. */
.who {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: fit-content;
  max-width: 100%;
  margin: 3rem auto 0;
  padding: 0.7rem 1.1rem;
  background: #1e293b;
  border-radius: 0.75rem;
}

.label {
  color: #94a3b8;
  font-size: 0.85rem;
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
  border: 1px solid #475569;
  border-radius: 999px;
  color: #cbd5e1;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
}

/* The same ring the initials wear, stretched to fit a couple of words — so it
   sits in the row rather than beside it. */
.mark {
  margin-left: 0.25rem;
  background: none;
  border: 1px solid #475569;
  border-radius: 999px;
  color: #94a3b8;
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
