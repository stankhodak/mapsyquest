import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type IControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Geometry } from 'geojson';
import type { LatLng } from '../data/types';
// Vite's dev server hangs on module-worker requests for files under node_modules
// (both maplibre-gl's own dynamic worker URL and a manual `new Worker()` to the same
// raw path reproduce it), so the worker script is copied to public/ as a plain static
// asset — see public/maplibre-gl-worker.mjs — and served completely outside Vite's
// module pipeline. Re-copy it from node_modules/maplibre-gl/dist/ after upgrading the
// maplibre-gl dependency.
setWorkerUrl('/maplibre-gl-worker.mjs');

interface MapScopeProps {
  center: LatLng;
  zoom: number;
  /** ISO alpha-2 id, used to look up this country's outline in the generated shape dataset. */
  countryId: string;
  /** Required when revealName is set. */
  countryName?: string;
  /** Show this country's outline (amber). Used for the country step's 3rd-try hint and the capital step. */
  revealOutline?: boolean;
  /** Also fit the camera to the outline's padded bounds when revealOutline turns on (country step only). */
  fitToOutline?: boolean;
  /** Show the country name as a small on-map label (capital step only). */
  revealName?: boolean;
  /** Bump to trigger a red flash of the outline + zoom-to-fit, then revert. */
  flashSignal?: number;
}

// OpenFreeMap: free vector tiles, no API key, ODbL-licensed OpenStreetMap data.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
// admin_level boundary layers in the "liberty" style (country, region, disputed).
const BORDER_LAYER_IDS = ['boundary_2', 'boundary_3', 'boundary_disputed'];
/** Borders only appear once zoomed in this many levels past the round's starting zoom. */
const BORDER_REVEAL_ZOOM_DELTA = 1.2;
const MIN_MAP_ZOOM = 1;
const MAX_MAP_ZOOM = 16;
const FLASH_DURATION_MS = 900;
const HINT_COLOR = '#f59e0b';
const HINT_FILL_OPACITY = 0.25;
const FLASH_COLOR = '#ef4444';
const FLASH_FILL_OPACITY = 0.55;
const OUTLINE_SOURCE_ID = 'target-country';
const OUTLINE_FILL_LAYER_ID = 'target-country-fill';
const OUTLINE_LINE_LAYER_ID = 'target-country-line';

function hideAllLabels(map: MapLibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
  }
}

function revealBordersPast(map: MapLibreMap, startZoom: number) {
  for (const id of BORDER_LAYER_IDS) {
    if (map.getLayer(id)) map.setLayerZoomRange(id, startZoom + BORDER_REVEAL_ZOOM_DELTA, 24);
  }
}

function setOutlinePaint(map: MapLibreMap, color: string, opacity: number) {
  if (!map.getLayer(OUTLINE_FILL_LAYER_ID)) return;
  map.setPaintProperty(OUTLINE_FILL_LAYER_ID, 'fill-color', color);
  map.setPaintProperty(OUTLINE_FILL_LAYER_ID, 'fill-opacity', opacity);
  map.setPaintProperty(OUTLINE_LINE_LAYER_ID, 'line-color', color);
  map.setPaintProperty(OUTLINE_LINE_LAYER_ID, 'line-opacity', opacity > 0 ? 1 : 0);
}

function fitToBounds(map: MapLibreMap, bbox: [number, number, number, number], animate: boolean) {
  map.fitBounds(
    [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ],
    { padding: 24, duration: animate ? 500 : 0, maxZoom: MAX_MAP_ZOOM },
  );
}

/** Compact attribution control that starts fully collapsed to just an "i" toggle. */
class CollapsedAttributionControl implements IControl {
  private container: HTMLDivElement | null = null;

  onAdd(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl';

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Map attribution');
    button.className =
      'flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/80 text-[11px] font-semibold text-slate-100 hover:bg-slate-700';
    button.textContent = 'i';

    const panel = document.createElement('div');
    panel.hidden = true;
    panel.className =
      'absolute right-0 mt-1 whitespace-nowrap rounded bg-slate-800/95 px-2 py-1 text-[10px] text-slate-300 shadow-lg';
    panel.innerHTML =
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" class="underline">OpenStreetMap</a> · <a href="https://openfreemap.org" target="_blank" rel="noopener" class="underline">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener" class="underline">OpenMapTiles</a>';

    button.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
    });

    container.style.position = 'relative';
    container.appendChild(button);
    container.appendChild(panel);
    this.container = container;
    return container;
  }

  onRemove(): void {
    this.container?.remove();
    this.container = null;
  }
}

/** Module-level cache: the generated shape dataset is ~270KB, so it's dynamically
 * imported (its own chunk, not the main bundle) and fetched only once per session. */
let shapesPromise: Promise<typeof import('../data/countryShapes.generated')> | null = null;
function loadCountryShapes() {
  shapesPromise ??= import('../data/countryShapes.generated');
  return shapesPromise;
}

/**
 * Interactive map scope built on MapLibre GL with free OpenFreeMap vector tiles
 * (a real-world basemap, no API key/account needed). All text and icon labels
 * (place names, POIs, road shields) are permanently hidden since they'd give away
 * the country/capital answer outright. Country and admin borders are hidden by
 * default and only appear once the player zooms in noticeably past the round's
 * starting scope, mirroring the "no country borders shown by default" requirement
 * in geo-game-instructions.md.
 */
export function MapScope({
  center,
  zoom,
  countryId,
  countryName,
  revealOutline,
  fitToOutline,
  revealName,
  flashSignal,
}: MapScopeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const shapeRef = useRef<{ bbox: [number, number, number, number] } | null>(null);
  const layersReadyRef = useRef(false);
  const revealOutlineRef = useRef(revealOutline);
  // A plain re-render (forceRerender) wouldn't re-run the revealOutline effect below,
  // since its dependency array wouldn't have changed — this tick is an explicit
  // dependency so that effect re-applies once the (async-loaded) layers exist.
  const [layersReadyTick, setLayersReadyTick] = useState(0);

  revealOutlineRef.current = revealOutline;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MapLibreMap({
      container,
      style: STYLE_URL,
      center: [center.lng, center.lat],
      zoom,
      minZoom: MIN_MAP_ZOOM,
      maxZoom: MAX_MAP_ZOOM,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new CollapsedAttributionControl(), 'top-right');

    map.once('style.load', () => {
      hideAllLabels(map);
      revealBordersPast(map, zoom);
    });

    markerRef.current = new Marker({ color: '#f43f5e' }).setLngLat([center.lng, center.lat]).addTo(map);
    mapRef.current = map;

    let cancelled = false;
    loadCountryShapes().then(({ countryShapes }) => {
      if (cancelled) return;
      const shape = countryShapes[countryId];
      if (!shape) return; // no outline data for this country (see build script)
      shapeRef.current = { bbox: shape.bbox };

      function addLayers() {
        if (map.getSource(OUTLINE_SOURCE_ID)) return;
        map.addSource(OUTLINE_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: shape.geometry as Geometry },
        });
        map.addLayer({
          id: OUTLINE_FILL_LAYER_ID,
          type: 'fill',
          source: OUTLINE_SOURCE_ID,
          paint: { 'fill-color': HINT_COLOR, 'fill-opacity': 0 },
        });
        map.addLayer({
          id: OUTLINE_LINE_LAYER_ID,
          type: 'line',
          source: OUTLINE_SOURCE_ID,
          paint: { 'line-color': HINT_COLOR, 'line-width': 2, 'line-opacity': 0 },
        });
        layersReadyRef.current = true;
        setLayersReadyTick((n) => n + 1);
      }

      // Poll rather than listen for a one-shot readiness event: whichever style event
      // this waited on ('style.load', then 'idle') could already have fired before this
      // (async, dynamically-imported) callback ran, permanently missing it. A short
      // poll can't miss a state transition the way an event listener can.
      function tryAddLayers() {
        if (cancelled) return;
        if (map.isStyleLoaded()) addLayers();
        else window.setTimeout(tryAddLayers, 150);
      }
      tryAddLayers();
    });

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      layersReadyRef.current = false;
    };
    // Each round/step renders its own MapScope instance (see RoundFlow's per-round `key`
    // and CountryStep/CapitalStep/FlagStep being distinct components), so center/zoom/
    // countryId are only ever read once at construction — no need to react to changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show/hide the persistent outline hint (country step's 3rd-try hint; capital step).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    if (revealOutline) {
      setOutlinePaint(map, HINT_COLOR, HINT_FILL_OPACITY);
      if (fitToOutline && shapeRef.current) fitToBounds(map, shapeRef.current.bbox, true);
    } else {
      setOutlinePaint(map, HINT_COLOR, 0);
    }
    // layersReadyTick isn't read here, but bumping it re-runs this effect once the
    // (async-loaded) outline layers exist, applying whatever revealOutline already was.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealOutline, fitToOutline, layersReadyTick]);

  // On a wrong guess (flashSignal bump): fit to the country's bounds, flash its
  // outline red, then either settle back into the hint state or return to the
  // round's starting view — per the "wrong answer" feedback in geo-game-instructions.md.
  useEffect(() => {
    if (!flashSignal) return;
    const map = mapRef.current;
    if (!map) return;

    if (!layersReadyRef.current || !shapeRef.current) {
      // No outline data for this country (see build script) — fall back to a plain
      // camera reset so wrong guesses still get some feedback.
      map.jumpTo({ center: [center.lng, center.lat], zoom });
      return;
    }

    setOutlinePaint(map, FLASH_COLOR, FLASH_FILL_OPACITY);
    fitToBounds(map, shapeRef.current.bbox, true);

    const timeout = window.setTimeout(() => {
      if (revealOutlineRef.current) {
        setOutlinePaint(map, HINT_COLOR, HINT_FILL_OPACITY);
      } else {
        setOutlinePaint(map, HINT_COLOR, 0);
        map.easeTo({ center: [center.lng, center.lat], zoom, duration: 500 });
      }
    }, FLASH_DURATION_MS);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashSignal]);

  function resetView() {
    mapRef.current?.jumpTo({ center: [center.lng, center.lat], zoom });
  }

  return (
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2">
      <div
        ref={containerRef}
        className="relative aspect-video w-full touch-none select-none overflow-hidden rounded-xl border border-slate-700 bg-sky-950"
      >
        {revealName && countryName && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-slate-800/80 px-2 py-1 text-xs font-medium text-slate-100">
            {countryName}
          </div>
        )}

        <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn({ duration: 150 })}
            className="flex h-7 w-7 items-center justify-center rounded bg-slate-800/80 text-slate-100 hover:bg-slate-700"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut({ duration: 150 })}
            className="flex h-7 w-7 items-center justify-center rounded bg-slate-800/80 text-slate-100 hover:bg-slate-700"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>

        <button
          type="button"
          onClick={resetView}
          className="absolute bottom-2 left-2 z-10 rounded bg-slate-800/80 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-300 hover:bg-slate-700"
        >
          reset view
        </button>
      </div>
    </div>
  );
}
