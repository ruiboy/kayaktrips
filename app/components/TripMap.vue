<script setup lang="ts">
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'

export type MapPoint = {
  id: string
  kind: 'start' | 'end' | 'campsite'
  label: string
  sub?: string
  lat: number
  lon: number
}

const props = defineProps<{
  points: MapPoint[]
  // When set, the next click on the map reports a coordinate instead of doing
  // nothing. The parent decides what it's for.
  picking: boolean
}>()

const emit = defineEmits<{ place: [{ lat: number; lon: number }] }>()

const container = ref<HTMLElement | null>(null)
let map: MapLibreMap | null = null
let markers: Marker[] = []
let resizeObserver: ResizeObserver | null = null

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

function markerElement(point: MapPoint) {
  const el = document.createElement('div')
  el.className = `pin pin-${point.kind}`
  el.textContent =
    point.kind === 'start' ? 'A' : point.kind === 'end' ? 'B' : (point.sub ?? '')
  el.title = point.label
  return el
}

async function draw(maplibre: typeof import('maplibre-gl')) {
  if (!map) return

  for (const marker of markers) marker.remove()
  markers = []

  for (const point of props.points) {
    markers.push(
      new maplibre.Marker({ element: markerElement(point) })
        .setLngLat([point.lon, point.lat])
        .setPopup(
          new maplibre.Popup({ offset: 18, closeButton: false }).setText(
            point.sub ? `${point.label} — ${point.sub}` : point.label,
          ),
        )
        .addTo(map),
    )
  }

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
  resizeObserver = new ResizeObserver(() => map?.resize())
  resizeObserver.observe(container.value as HTMLElement)

  await new Promise<void>((resolve) => map?.once('load', () => resolve()))
  await draw(maplibre)

  watch(
    () => props.points,
    async () => draw(await import('maplibre-gl')),
    { deep: true },
  )
})

onBeforeUnmount(() => {
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
</style>
