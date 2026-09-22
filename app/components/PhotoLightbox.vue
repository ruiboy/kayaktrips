<script setup lang="ts">
// Clicking a tile used to hand the browser the raw jpg in a new tab, which
// lost the caption, lost the way back, and made every next photo a trip back
// to the grid. This keeps you on the page: the original as large as the screen
// allows, its caption on it, and the rest of the set a keypress away.
//
// Shared by the gallery and the trip page. Each passes the list it is already
// showing, so "next" means the next one on screen rather than the next one in
// the database.
export type LightboxPhoto = {
  id: string
  storage_path: string
  caption: string | null
  // Optional, and supplied by the gallery only. A trip page is already headed
  // by the trip's name, so naming it again under every photo would be noise;
  // on /photos, which mixes every trip together, the caption alone leaves you
  // with no idea where you are.
  trip?: { title: string } | null
}

const props = defineProps<{ photos: LightboxPhoto[] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const index = ref(0)
// Nothing inside the panel renders until it is opened. A hidden <img> is still
// fetched, so leaving the markup in place would have every visit to the grid
// quietly pull one full-size original — the exact cost the thumbnails exist to
// avoid.
const open = ref(false)

const current = computed(() => props.photos[index.value] ?? null)

// What the <img> is actually showing. Every photo starts on its thumbnail,
// which the grid has already cached, so a click paints immediately; the
// original swaps in underneath once it has decoded. Thumbnails are 1024px and
// keep their aspect ratio, so the stand-in is the right picture at the right
// shape rather than a placeholder — on anything but a very wide screen it is
// the right size too.
const src = ref('')

// Called on every move rather than watching `current`, because reopening the
// same photo has to reload it and a watcher would see no change at all.
function display(at: number) {
  const photo = props.photos[at]
  if (!photo) return
  index.value = at

  const full = photoUrl(photo.storage_path)
  src.value = thumbUrl(photo.storage_path)

  const loader = new Image()
  loader.onload = () => {
    // The set can have moved on while several megabytes were in flight.
    if (current.value?.id === photo.id) src.value = full
  }
  loader.src = full
}

// Opened by id, not by position: the two lists this serves can lose a row to
// the delete in PhotoDialog, and an index captured at click time would then
// point at the wrong photo.
function show(id: string) {
  const at = props.photos.findIndex((photo) => photo.id === id)
  if (at === -1) return
  display(at)
  open.value = true
  dialog.value?.showModal()
}

function step(by: number) {
  const next = index.value + by
  if (next < 0 || next >= props.photos.length) return
  display(next)
}

// A photo deleted from underneath us — or a list that reloaded shorter — would
// otherwise leave the panel showing nothing.
watch(
  () => props.photos.length,
  (length) => {
    if (!length) dialog.value?.close()
    else if (index.value >= length) display(length - 1)
  },
)

defineExpose({ show })
</script>

<template>
  <!-- Arrow keys land here because a modal dialog holds focus; Escape is the
       browser's own. The panel fills the viewport, so there is no backdrop
       left to click — the dark margin beside the photo closes it instead. -->
  <dialog
    ref="dialog"
    class="lightbox"
    @close="open = false"
    @keydown.arrow-left.prevent="step(-1)"
    @keydown.arrow-right.prevent="step(1)"
  >
    <div v-if="open && current" class="stage" @click.self="dialog?.close()">
      <!-- Shrink-wraps the photo, so the controls sit on its edges rather than
           on the screen's: on a portrait photo they stay over the picture
           instead of stranding themselves out in the margin. -->
      <div class="frame">
        <img :src="src" :alt="current.caption ?? ''" />

        <button class="control close" aria-label="Close" @click="dialog?.close()">
          ×
        </button>
        <button
          class="control step prev"
          aria-label="Previous photo"
          :disabled="index === 0"
          @click="step(-1)"
        >
          ‹
        </button>
        <button
          class="control step next"
          aria-label="Next photo"
          :disabled="index === photos.length - 1"
          @click="step(1)"
        >
          ›
        </button>

        <div class="foot">
          <p class="caption">
            <span v-if="current.trip" class="trip">{{ current.trip.title }}</span>
            <span v-if="current.trip && current.caption" class="sep"> · </span>
            {{ current.caption }}
          </p>
          <p class="count">{{ index + 1 }} of {{ photos.length }}</p>
        </div>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  max-width: 100%;
  max-height: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: #020617;
  color: #e2e8f0;
  overflow: hidden;
}

.lightbox::backdrop {
  background: #020617;
}

.stage {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.frame {
  position: relative;
  display: flex;
  max-width: 100%;
  max-height: 100%;
}

/* Capped against the viewport rather than against a parent, so the browser's
   own rule for replaced elements does the fitting: whichever side reaches the
   screen first sets the size and the other follows the photo's shape. A
   landscape photo fills the width, a portrait one the height. */
.frame img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100vw;
  max-height: 100vh;
  max-height: 100dvh;
}

/* No panel behind them — a plate for each button put a slab of chrome on top
   of the photo. The shadow is what keeps a white glyph legible against a
   pale sky. */
.control {
  position: absolute;
  background: none;
  border: none;
  padding: 0;
  color: #fff;
  line-height: 1;
  cursor: pointer;
  filter: drop-shadow(0 1px 4px #020617) drop-shadow(0 0 12px #020617bf);
  transition: opacity 0.15s;
}

.control:hover:not(:disabled) {
  color: #38bdf8;
}

.control:disabled {
  opacity: 0.2;
  cursor: default;
}

.step {
  top: 50%;
  /* Tall and narrow: the whole side of the photo is the target, which is what
     a thumb reaches for on a phone. */
  transform: translateY(-50%);
  width: 3.5rem;
  height: 40%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3.5rem;
}

.prev {
  left: 0;
}

.next {
  right: 0;
}

.close {
  top: 0;
  right: 0;
  width: 3rem;
  height: 3rem;
  font-size: 2rem;
}

/* Over the photo rather than under it, so the picture keeps the whole screen.
   The scrim is what makes it readable over a bright shoreline. */
.foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 2.5rem 1rem 0.75rem;
  background: linear-gradient(to top, #020617d9, #02061700);
  pointer-events: none;
}

.caption {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.4;
  text-shadow: 0 1px 3px #020617;
}

/* The accent, the same as the trip link on the tile underneath — so it reads
   as the place this photo belongs to rather than as the first words of the
   caption. */
.trip {
  color: #38bdf8;
}

.sep {
  color: #64748b;
}

.count {
  margin: 0;
  flex: none;
  color: #cbd5e1;
  font-size: 0.8rem;
  text-shadow: 0 1px 3px #020617;
}

@media (max-width: 30rem) {
  .step {
    width: 2.75rem;
    font-size: 2.75rem;
  }
}
</style>
