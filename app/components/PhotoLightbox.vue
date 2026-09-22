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

// The photo's shape, which the frame is sized from. Taken from whichever image
// has loaded — a thumbnail keeps its original's aspect ratio, so the cached one
// answers this before the original arrives. 4:3 until then, and only for the
// first photo of a session: a landscape guess is right more often than not and
// nothing is distorted by a wrong one, since the image is `contain`ed inside
// the frame it sizes.
const ratio = ref(4 / 3)

// How tall the photo may be drawn: its own height, and no more. Half this
// library predates any phone worth the name — eight of thirty photos are
// 960px wide — and stretching one of those across a desktop window invents
// most of what it shows. On a phone every photo is larger than the viewport,
// so the cap never binds and nothing changes there.
const cap = ref<number | null>(null)

// Thumbnails are made with `scale-down` at this width (THUMB_WIDTH, in
// server/utils/thumbs.ts), so one narrower than this is its original at full
// size and can be trusted for the cap. One exactly this wide says only "the
// original is at least this big" — so the cap waits for the original itself
// rather than pinning a 4000px photo at 1024.
const THUMB_WIDTH = 1024

function onLoad(event: Event) {
  const img = event.target as HTMLImageElement
  if (!img.naturalWidth || !img.naturalHeight) return

  ratio.value = img.naturalWidth / img.naturalHeight

  const isThumb = img.currentSrc.includes('-thumb.webp')
  if (!isThumb || img.naturalWidth < THUMB_WIDTH) cap.value = img.naturalHeight
}

// Called on every move rather than watching `current`, because reopening the
// same photo has to reload it and a watcher would see no change at all.
function display(at: number) {
  const photo = props.photos[at]
  if (!photo) return
  index.value = at
  cap.value = null

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
      <div
        class="frame"
        :style="{ '--ratio': ratio, '--cap': cap ? `${cap}px` : '100cqh' }"
      >
        <img :src="src" :alt="current.caption ?? ''" @load="onLoad" />

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
  /* Measured, so the frame below can size itself against this box in both
     axes. Capping the image against the viewport instead looked right but
     only ever scaled it down: a photo narrower than the window sat at its
     natural size with dark bands all round, and nothing in CSS lets a height
     be worked out from a container's width without this. */
  container-type: size;
}

/* The largest box of the photo's shape that fits: the height it wants, or the
   height its width allows, whichever is smaller. Sized rather than shrink-
   wrapped around the image so it scales up as well as down — and because the
   controls hang off this box, they stay on the picture's own edges rather than
   out in the margin beside a portrait photo. */
.frame {
  position: relative;
  aspect-ratio: var(--ratio, 1.3333);
  /* The height it wants, the height its width allows, or the height it
     actually has — whichever is smallest. The third term is what keeps a small
     photo from being blown up to fit; on a phone it never wins. */
  height: min(100cqh, calc(100cqw / var(--ratio, 1.3333)), var(--cap, 100cqh));
  /* The cap arrives with the original, a moment after the thumbnail has
     painted. For the few photos between 1024px and a window's width that
     means settling to their true size rather than snapping to it. */
  transition: height 0.15s ease-out;
}

.frame img {
  display: block;
  width: 100%;
  height: 100%;
  /* The frame is already the photo's shape, so this only guards the moment
     before a new one's dimensions are known. */
  object-fit: contain;
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
