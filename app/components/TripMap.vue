<script setup lang="ts">
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'

export type MapPoint = {
  id: string
  kind: 'start' | 'end' | 'campsite'
  label: string
  sub?: string
  lat: number
  lon: number
  // Which trip the point belongs to, and where to send someone who clicks its
  // popup. Only the all-trips map sets these — a single trip's map has one
  // subject and nothing to link to.
  tripId?: string
  tripTitle?: string
  tripSlug?: string
  // Index into TRIP_COLOURS. Absent means the kind-based colours below, which
  // is what a single trip's map wants.
  colour?: number
}

const props = defineProps<{
  points: MapPoint[]
  // When set, the next click on the map reports a coordinate instead of doing
  // nothing. The parent decides what it's for.
  picking: boolean
  // When set, every point belonging to another trip dims. The view deliberately
  // stays where it is: re-framing on each selection loses the overview, which
  // is the reason to be on an all-trips map at all.
  focusedTripId?: string | null
}>()

const emit = defineEmits<{ place: [{ lat: number; lon: number }] }>()

const route = useRoute()
const campsiteFocus = useCampsiteFocus()

const container = ref<HTMLElement | null>(null)
let map: MapLibreMap | null = null
let markers: Marker[] = []
let resizeObserver: ResizeObserver | null = null
// Set once the reader pans or zooms themselves, after which the map stops
// re-framing itself under them.
let userMoved = false

// Raster OpenStreetMap rather than a vector style: free outright, no key, no
// account. Attribution is required by the licence and MapLibre renders it from
// the source definition.
const STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
}

// Australia, so an empty map opens somewhere plausible rather than off Africa.
const FALLBACK_CENTRE: [number, number] = [139.7, -34.3]

// Two elements, not one: MapLibre owns `transform` on whatever element it is
// given, using it to position the marker. Anything that wants to scale — which
// focusing does — has to be inside that, or the pin detaches from its
// coordinate.
function markerElement(point: MapPoint) {
  const anchor = document.createElement('div')
  anchor.className = 'pin-anchor'
  anchor.title = point.label

  const el = document.createElement('div')
  el.className = `pin pin-${point.kind}`
  el.textContent =
    point.kind === 'start' ? 'A' : point.kind === 'end' ? 'B' : (point.sub ?? '')
  // A trip colour overrides the kind colour, so one trip's points read as a
  // set. The A/B/number glyph still says which kind each one is.
  if (point.colour !== undefined) {
    el.style.background = tripColour(point.colour)
  }

  anchor.appendChild(el)
  return anchor
}

// Trip titles and campsite names are typed by editors and land in the popup's
// markup. Escaped rather than trusted: `setHTML` would otherwise run whatever
// a name contained.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// What a point says when you click it. On the all-trips map that means naming
// the trip and offering a way into it; on a single trip's map the trip is
// already the page you're on, so it stays a plain line of text.
function popupHtml(point: MapPoint) {
  const place =
    point.kind === 'start'
      ? 'Put-in'
      : point.kind === 'end'
        ? 'Take-out'
        : 'Campsite'

  // On the all-trips map `label` is prefixed with the trip title, which the
  // heading already says. Strip it rather than read it twice.
  const name =
    point.tripTitle && point.label.startsWith(`${point.tripTitle} — `)
      ? point.label.slice(point.tripTitle.length + 3)
      : point.label

  // A single trip's map: the trip is the page you are on, so there is nothing
  // to open — except a campsite, which is further down this same page and
  // otherwise has to be hunted for in the list.
  if (!point.tripSlug) {
    const line = `<p class="pop-name">${escapeHtml(name)}</p>`
    return point.kind === 'campsite'
      ? `${line}<a class="pop-link" href="#campsite-${encodeURIComponent(point.id)}">Go to campsite &darr;</a>`
      : line
  }

  return [
    `<p class="pop-trip">${escapeHtml(point.tripTitle ?? '')}</p>`,
    `<p class="pop-name"><span class="pop-kind">${place}</span> ${escapeHtml(name)}</p>`,
    // A campsite's popup opens the campsite — scrolled to and flashed on the
    // trip page — so the link says that rather than promising the trip and
    // delivering something else.
    point.kind === 'campsite'
      ? `<a class="pop-link" href="/trips/${encodeURIComponent(point.tripSlug)}#campsite-${encodeURIComponent(point.id)}">Go to campsite &rarr;</a>`
      : `<a class="pop-link" href="/trips/${encodeURIComponent(point.tripSlug)}">Open this trip &rarr;</a>`,
  ].join('')
}

async function draw(maplibre: typeof import('maplibre-gl')) {
  if (!map) return

  for (const marker of markers) marker.remove()
  markers = []

  for (const point of props.points) {
    const element = markerElement(point)
    if (props.focusedTripId) {
      element.classList.add(
        point.tripId === props.focusedTripId ? 'is-focused' : 'is-dimmed',
      )
    }
    markers.push(
      new maplibre.Marker({ element })
        .setLngLat([point.lon, point.lat])
        .setPopup(
          new maplibre.Popup({ offset: 18, closeButton: true, maxWidth: '16rem' })
            .setHTML(popupHtml(point)),
        )
        .addTo(map),
    )
  }

  frame(maplibre)
}

// Separate from drawing, because a resize needs to re-frame without rebuilding
// every marker — and must not do so once the reader has panned somewhere.
function frame(maplibre: typeof import('maplibre-gl')) {
  if (!map || userMoved) return

  if (props.points.length === 1) {
    const only = props.points[0]!
    map.jumpTo({ center: [only.lon, only.lat], zoom: 12 })
  } else if (props.points.length > 1) {
    const bounds = new maplibre.LngLatBounds()
    for (const point of props.points) bounds.extend([point.lon, point.lat])
    map.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 0 })
  }
}

const failed = ref('')

onMounted(async () => {
  // Imported here rather than at the top so the ~500 KB of MapLibre never
  // reaches the server bundle or a page that doesn't show a map.
  const maplibre = await import('maplibre-gl')

  try {
    map = new maplibre.Map({
      container: container.value as HTMLElement,
      style: STYLE,
      center: FALLBACK_CENTRE,
      zoom: 6,
      attributionControl: { compact: true },
    })
  } catch (cause) {
    // MapLibre needs WebGL2 and throws outright without it — an old browser, a
    // hardened one, or software rendering disabled. Unhandled, that surfaces as
    // a broken page rather than a missing map.
    failed.value =
      cause instanceof Error && /webgl/i.test(cause.message)
        ? "This browser can't display the map — it needs WebGL2."
        : 'The map failed to load.'
    return
  }

  map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right')
  map.on('click', (event) => {
    if (!props.picking) return
    emit('place', { lat: event.lngLat.lat, lon: event.lngLat.lng })
  })

  // MapLibre sizes its canvas once and then only follows the *window*. This
  // container changes on its own — the columns collapsing, the picking note
  // appearing, a stylesheet arriving late — and without this the canvas keeps
  // its old dimensions and the map renders into part of the box.
  //
  // Re-framing after the resize matters as much as the resize itself: a map
  // that fitted its bounds at the wrong size is left showing the wrong window
  // onto the world, which is how a two-marker trip came up showing one.
  resizeObserver = new ResizeObserver(async () => {
    if (!map) return
    map.resize()
    frame(await import('maplibre-gl'))
  })
  resizeObserver.observe(container.value as HTMLElement)

  container.value?.addEventListener('click', onPopupClick)

  // `originalEvent` is present only when a human caused it; our own fitBounds
  // and jumpTo would otherwise mark the map as moved on the first draw.
  for (const event of ['dragstart', 'zoomstart', 'rotatestart'] as const) {
    map.on(event, (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) userMoved = true
    })
  }

  await new Promise<void>((resolve) => map?.once('load', () => resolve()))
  await draw(maplibre)

  watch(
    () => props.points,
    async () => draw(await import('maplibre-gl')),
    { deep: true },
  )

  // Focus only changes which markers are dimmed, so this redraws them without
  // touching the view — `frame` is a no-op once the reader has moved, and even
  // before that the bounds haven't changed.
  watch(
    () => props.focusedTripId,
    async () => draw(await import('maplibre-gl')),
  )
})

// A popup's contents live in MapLibre's DOM, not in this template, so its
// links are caught here rather than bound in markup. Only the same-page ones:
// a link to another trip is an ordinary navigation and wants no help.
//
// Routed rather than left to the browser, because a bare fragment jump updates
// the URL without telling vue-router, so the hash watcher that scrolls to the
// campsite and flashes it would never run — you would get the jump and none of
// the rest.
function onPopupClick(event: MouseEvent) {
  const link = (event.target as HTMLElement)?.closest?.('a.pop-link')
  const href = link?.getAttribute('href')
  if (!href?.startsWith('#')) return

  event.preventDefault()

  // The focus is what actually moves the page; the URL is updated so the
  // campsite stays linkable from here.
  campsiteFocus.value = {
    id: decodeURIComponent(href.slice('#campsite-'.length)),
    at: Date.now(),
  }

  // `replaceState`, not the router: a router navigation runs Nuxt's scroll
  // behaviour, which jumps to the element instantly and then fights the smooth
  // scroll the list is already doing. This changes the address and nothing
  // else. Replace rather than push, too — showing something further down the
  // page you are on is not a place to go back from.
  history.replaceState(history.state, '', `${route.path}${href}`)
}

onBeforeUnmount(() => {
  container.value?.removeEventListener('click', onPopupClick)
  resizeObserver?.disconnect()
  resizeObserver = null
  // Each map holds a WebGL context and browsers cap how many may exist, so
  // leaving one behind eventually blanks every map on the site.
  map?.remove()
  map = null
})
</script>

<template>
  <div class="map-wrap" :class="{ picking }">
    <div v-show="!failed" ref="container" class="map" />

    <div v-if="failed" class="map failed">
      <p>{{ failed }}</p>
      <ul v-if="points.length" class="coord-list">
        <li v-for="point in points" :key="point.id">
          {{ point.label }} — {{ point.lat }}, {{ point.lon }}
        </li>
      </ul>
    </div>

    <p v-if="picking && !failed" class="hint">Click the map to place it.</p>
  </div>
</template>

<style scoped>
/* The same panel the campsite and photo cards use. A hairline border alone
   vanished against the bright tiles; a padded dark surround is what actually
   separates the map from the page. */
.map-wrap {
  position: relative;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 0.5rem;
}

.map {
  width: 100%;
  height: clamp(16rem, 45vh, 26rem);
  border-radius: 0.5rem;
  /* Clips the canvas and the map's own controls to the rounded corners. */
  overflow: hidden;
}

.picking .map {
  cursor: crosshair;
}

/* Without a map the coordinates are still worth showing — they're the data. */
.failed {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: #94a3b8;
  padding: 1.5rem;
  text-align: center;
}

.coord-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.85rem;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.picking {
  border-color: #38bdf8;
}

.hint {
  position: absolute;
  top: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  background: #0f172a;
  color: #38bdf8;
  border: 1px solid #38bdf8;
  border-radius: 0.4rem;
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
  pointer-events: none;
  z-index: 2;
}
</style>

<style>
/* MapLibre's stylesheet and the marker classes are global on purpose: markers
   are appended to the map's own DOM, outside this component's scope. */
@import 'maplibre-gl/dist/maplibre-gl.css';

.pin {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font: 600 0.75rem/1 system-ui, sans-serif;
  color: #0f172a;
  border: 2px solid #0f172a;
  box-shadow: 0 0.15rem 0.4rem rgb(0 0 0 / 0.4);
  cursor: pointer;
}

.pin-start {
  background: #4ade80;
}

.pin-end {
  background: #fb7185;
}

.pin-campsite {
  background: #38bdf8;
}

/* Focusing works from both ends: the chosen trip grows and gains a ring, the
   rest drop back to grey. Dimming alone was too quiet to find a trip by. The
   others stay visible and clickable — they are the context that makes the
   focused one mean anything. */
.pin-anchor .pin {
  transition:
    transform 0.15s ease,
    opacity 0.15s ease,
    box-shadow 0.15s ease,
    filter 0.15s ease;
}

.pin-anchor.is-dimmed .pin {
  opacity: 0.3;
  filter: grayscale(1);
  transform: scale(0.8);
  box-shadow: none;
}

.pin-anchor.is-dimmed:hover .pin {
  opacity: 0.75;
  filter: none;
}

.pin-anchor.is-focused {
  z-index: 3;
}

.pin-anchor.is-focused .pin {
  transform: scale(1.35);
  border-color: #f8fafc;
  box-shadow:
    0 0 0 0.2rem #f8fafc66,
    0 0.25rem 0.6rem rgb(0 0 0 / 0.55);
}

/* The popup's contents are built in `popupHtml` and live in MapLibre's DOM,
   outside this component's scope, so these are global too. */
.maplibregl-popup-content {
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 0.7rem 0.85rem;
  font: 400 0.85rem/1.4 system-ui, sans-serif;
}

.maplibregl-popup-anchor-top .maplibregl-popup-tip {
  border-bottom-color: #1e293b;
}

.maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
  border-top-color: #1e293b;
}

.maplibregl-popup-anchor-left .maplibregl-popup-tip {
  border-right-color: #1e293b;
}

.maplibregl-popup-anchor-right .maplibregl-popup-tip {
  border-left-color: #1e293b;
}

.maplibregl-popup-close-button {
  color: #64748b;
  font-size: 1.1rem;
  padding: 0 0.3rem;
}

.pop-trip {
  margin: 0 0 0.2rem;
  font-weight: 600;
  color: #f8fafc;
}

.pop-name {
  margin: 0;
  color: #cbd5f5;
}

.pop-kind {
  color: #64748b;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-right: 0.3rem;
}

.pop-link {
  display: inline-block;
  margin-top: 0.5rem;
  color: #38bdf8;
  text-decoration: none;
  font-size: 0.8rem;
}

.pop-link:hover {
  text-decoration: underline;
}
</style>
