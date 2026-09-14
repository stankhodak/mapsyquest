import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type IControl } from 'maplibre-gl';
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
  /** ISO alpha-2 id of the round's answer, used to look up its outline for the hint/reveal. */
  countryId: string;
  /** Required when revealName is set. */
  countryName?: string;
  /** Show the answer country's outline (amber). Used for the country step's 3rd-try hint and the capital step. */
  revealOutline?: boolean;
  /** Also fit the camera to the outline's padded bounds when revealOutline turns on. */
  fitToOutline?: boolean;
  /** Fraction of the outline's own width/height added as margin per side when fitting to it (e.g. 0.15 = 30% larger box). Defaults to a generous hint-reveal margin; the capital step uses a tighter value so the country fills more of the frame. */
  outlinePaddingFraction?: number;
  /** Show the country name as an on-map label at labelPosition (capital/flag steps). */
  revealName?: boolean;
  /** Where to place the name label — the country's own centroid, not necessarily `center` (which may be the capital's pin). Required when revealName is set. */
  labelPosition?: LatLng;
  /** Also show a smaller capital-name caption right at the pin (`center`). Optional even when revealName is set — the country step's final-try reveal doesn't use it. */
  capitalName?: string;
  /** ISO alpha-2 id of the country the player actually guessed (wrong), if it matched a real country. Bump flashSignal to trigger a red flash of ITS outline; if this has no shape data, no flash occurs. */
  flashGuessId?: string | null;
  /** Bump to trigger the wrong-guess flash described above. */
  flashSignal?: number;
  /** Show the center-pin marker. Defaults to true; the start screen's purely decorative map turns it off. */
  showMarker?: boolean;
  /** Show the zoom +/- and reset-view buttons. Defaults to true; off for the start screen's decorative map. */
  showControls?: boolean;
  /** The round's question ("Which country is this?" etc.), shown as a caption pinned to the map's top-left corner instead of a separate bubble above it. */
  cornerLabel?: string;
  /** Start zoomed out to a wide world view and glide into the round's actual center/zoom, instead of opening already framed. Used for the country step's first look at a new round. */
  introGlide?: boolean;
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
/** Camera travel time for both the flash-to-wrong-country hop and the ease back —
 * kept equal so neither direction feels like an abrupt pop next to the other. */
const CAMERA_MOVE_DURATION_MS = 840;
/** As wide as the map ever goes (matches MIN_MAP_ZOOM), so the country step's intro
 * glide starts from as close to a full world view as the map allows. */
const INTRO_GLIDE_START_ZOOM = MIN_MAP_ZOOM;
const INTRO_GLIDE_DURATION_MS = 2000;
const HINT_COLOR = '#f59e0b';
const HINT_FILL_OPACITY = 0.25;
const FLASH_COLOR = '#ef4444';
const FLASH_FILL_OPACITY = 0.55;
const DEFAULT_OUTLINE_PADDING_FRACTION = 0.15;
/** The wrong-guess flash always uses this generous margin, regardless of outlinePaddingFraction. */
const GUESS_FLASH_PADDING_FRACTION = 0.15;
const HINT_SOURCE_ID = 'hint-country';
const HINT_FILL_LAYER_ID = 'hint-country-fill';
const HINT_LINE_LAYER_ID = 'hint-country-line';
const GUESS_SOURCE_ID = 'guess-country';
const GUESS_FILL_LAYER_ID = 'guess-country-fill';
const GUESS_LINE_LAYER_ID = 'guess-country-line';

type Shape = { bbox: [number, number, number, number]; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } };

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

/** Zoom range past MAX_MAP_ZOOM, so the layer can never actually render — used while the
 * round hasn't earned its hint yet, so a player can't bypass "no borders" by just zooming
 * the base map in (independent of the amber hint outline, which is the only sanctioned way
 * to see a country's real shape). */
function hideBorders(map: MapLibreMap) {
  for (const id of BORDER_LAYER_IDS) {
    if (map.getLayer(id)) map.setLayerZoomRange(id, MAX_MAP_ZOOM + 1, 24);
  }
}

function setOutlineOpacity(map: MapLibreMap, fillLayerId: string, lineLayerId: string, opacity: number) {
  if (!map.getLayer(fillLayerId)) return;
  map.setPaintProperty(fillLayerId, 'fill-opacity', opacity);
  map.setPaintProperty(lineLayerId, 'line-opacity', opacity > 0 ? 1 : 0);
}

/** Expands a raw bbox by `fraction` of its own width/height on each side. */
function padBbox(bbox: [number, number, number, number], fraction: number): [number, number, number, number] {
  const [west, south, east, north] = bbox;
  const lngPad = (east - west) * fraction;
  const latPad = (north - south) * fraction;
  return [west - lngPad, south - latPad, east + lngPad, north + latPad];
}

function fitToBounds(map: MapLibreMap, bbox: [number, number, number, number], animate: boolean) {
  map.fitBounds(
    [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ],
    { padding: 24, duration: animate ? CAMERA_MOVE_DURATION_MS : 0, maxZoom: MAX_MAP_ZOOM },
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

function createLabelElement(text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text.toUpperCase();
  el.style.fontFamily = 'Georgia, "Times New Roman", serif';
  el.style.fontWeight = '700';
  el.style.fontSize = '20px';
  el.style.letterSpacing = '0.08em';
  el.style.color = '#1e293b';
  el.style.textShadow = '0 0 5px #fff, 0 0 5px #fff, 0 0 8px #fff';
  el.style.pointerEvents = 'none';
  el.style.whiteSpace = 'nowrap';
  return el;
}

/** Smaller companion label for the capital city name, styled like a map pin caption
 * rather than the bold country-name banner above. */
function createCapitalLabelElement(text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.fontFamily = 'Georgia, "Times New Roman", serif';
  el.style.fontWeight = '700';
  el.style.fontSize = '13px';
  el.style.color = '#1e293b';
  el.style.textShadow = '0 0 4px #fff, 0 0 4px #fff, 0 0 6px #fff';
  el.style.pointerEvents = 'none';
  el.style.whiteSpace = 'nowrap';
  return el;
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
  outlinePaddingFraction = DEFAULT_OUTLINE_PADDING_FRACTION,
  revealName,
  labelPosition,
  capitalName,
  flashGuessId,
  flashSignal,
  showMarker = true,
  showControls = true,
  cornerLabel,
  introGlide,
}: MapScopeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const labelMarkerRef = useRef<Marker | null>(null);
  const capitalLabelMarkerRef = useRef<Marker | null>(null);
  const shapesRecordRef = useRef<Record<string, Shape> | null>(null);
  const hintShapeRef = useRef<Shape | null>(null);
  const layersReadyRef = useRef(false);
  const revealOutlineRef = useRef(revealOutline);
  // A plain re-render wouldn't re-run the revealOutline effect below, since its
  // dependency array wouldn't have changed — this tick is an explicit dependency so
  // that effect re-applies once the (async-loaded) layers exist.
  const [layersReadyTick, setLayersReadyTick] = useState(0);

  revealOutlineRef.current = revealOutline;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MapLibreMap({
      container,
      style: STYLE_URL,
      center: [center.lng, center.lat],
      zoom: introGlide ? INTRO_GLIDE_START_ZOOM : zoom,
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
      hideBorders(map);
      if (introGlide) {
        map.flyTo({ center: [center.lng, center.lat], zoom, duration: INTRO_GLIDE_DURATION_MS });
      }
    });

    if (showMarker) {
      markerRef.current = new Marker({ color: '#f43f5e' }).setLngLat([center.lng, center.lat]).addTo(map);
    }
    mapRef.current = map;

    if (revealName && labelPosition && countryName) {
      // Offset well clear of the pin: labelPosition (country centroid) and center (the
      // pin's own coordinate, usually the capital) can sit very close together for
      // compact countries, which would otherwise render the label right on top of the
      // pin's teardrop body.
      labelMarkerRef.current = new Marker({
        element: createLabelElement(countryName),
        anchor: 'center',
        offset: [0, -28],
      })
        .setLngLat([labelPosition.lng, labelPosition.lat])
        .addTo(map);
    }

    if (revealName && capitalName) {
      capitalLabelMarkerRef.current = new Marker({
        element: createCapitalLabelElement(capitalName),
        anchor: 'top',
        offset: [0, 12],
      })
        .setLngLat([center.lng, center.lat])
        .addTo(map);
    }

    let cancelled = false;
    loadCountryShapes().then(({ countryShapes }) => {
      if (cancelled) return;
      shapesRecordRef.current = countryShapes;
      const shape = countryShapes[countryId];
      if (!shape) return; // no outline data for this country (see build script)
      hintShapeRef.current = shape;

      function addLayers() {
        if (map.getSource(HINT_SOURCE_ID)) return;
        map.addSource(HINT_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: shape.geometry as Geometry },
        });
        map.addLayer({
          id: HINT_FILL_LAYER_ID,
          type: 'fill',
          source: HINT_SOURCE_ID,
          paint: { 'fill-color': HINT_COLOR, 'fill-opacity': 0 },
        });
        map.addLayer({
          id: HINT_LINE_LAYER_ID,
          type: 'line',
          source: HINT_SOURCE_ID,
          paint: { 'line-color': HINT_COLOR, 'line-width': 2, 'line-opacity': 0 },
        });

        // Guess-flash layer starts on the same geometry as a harmless placeholder
        // (hidden); its data is swapped to whichever country the player guessed
        // wrong, at flash time.
        map.addSource(GUESS_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: shape.geometry as Geometry },
        });
        map.addLayer({
          id: GUESS_FILL_LAYER_ID,
          type: 'fill',
          source: GUESS_SOURCE_ID,
          paint: { 'fill-color': FLASH_COLOR, 'fill-opacity': 0 },
        });
        map.addLayer({
          id: GUESS_LINE_LAYER_ID,
          type: 'line',
          source: GUESS_SOURCE_ID,
          paint: { 'line-color': FLASH_COLOR, 'line-width': 2, 'line-opacity': 0 },
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
      labelMarkerRef.current?.remove();
      capitalLabelMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      labelMarkerRef.current = null;
      capitalLabelMarkerRef.current = null;
      layersReadyRef.current = false;
    };
    // Each round/step renders its own MapScope instance (see RoundFlow's per-round `key`
    // and CountryStep/CapitalStep/FlagStep being distinct components), so center/zoom/
    // countryId/labelPosition etc. are only ever read once at construction — no need to
    // react to changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show/hide the persistent outline hint (country step's 3rd-try hint; capital step).
  // The base map's own admin-boundary lines are tied to the same on/off switch — they're
  // as much a hint as the amber outline is (see hideBorders), so they only ever become
  // zoomable-into once the round has actually earned that hint, not just from zooming in.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    if (revealOutline) {
      setOutlineOpacity(map, HINT_FILL_LAYER_ID, HINT_LINE_LAYER_ID, HINT_FILL_OPACITY);
      revealBordersPast(map, zoom);
      if (fitToOutline && hintShapeRef.current) {
        fitToBounds(map, padBbox(hintShapeRef.current.bbox, outlinePaddingFraction), true);
      }
    } else {
      setOutlineOpacity(map, HINT_FILL_LAYER_ID, HINT_LINE_LAYER_ID, 0);
      hideBorders(map);
    }
    // layersReadyTick isn't read here, but bumping it re-runs this effect once the
    // (async-loaded) outline layers exist, applying whatever revealOutline already was.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealOutline, fitToOutline, outlinePaddingFraction, layersReadyTick]);

  // On a wrong guess (flashSignal bump): flash the GUESSED country's outline in red,
  // fit to its bounds, then either settle back into the hint state or return to the
  // round's starting view. If the guess didn't match a real country (or we have no
  // shape data for it), no map flash occurs at all.
  useEffect(() => {
    if (!flashSignal) return;
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;

    const guessShape = flashGuessId ? shapesRecordRef.current?.[flashGuessId] : null;
    if (!guessShape) return;

    const source = map.getSource(GUESS_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData({ type: 'Feature', properties: {}, geometry: guessShape.geometry as Geometry });
    setOutlineOpacity(map, GUESS_FILL_LAYER_ID, GUESS_LINE_LAYER_ID, FLASH_FILL_OPACITY);
    fitToBounds(map, padBbox(guessShape.bbox, GUESS_FLASH_PADDING_FRACTION), true);

    const timeout = window.setTimeout(() => {
      setOutlineOpacity(map, GUESS_FILL_LAYER_ID, GUESS_LINE_LAYER_ID, 0);
      if (revealOutlineRef.current && hintShapeRef.current) {
        fitToBounds(map, padBbox(hintShapeRef.current.bbox, outlinePaddingFraction), true);
      } else {
        map.easeTo({ center: [center.lng, center.lat], zoom, duration: CAMERA_MOVE_DURATION_MS });
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
        {cornerLabel && (
          <div
            className="absolute left-2 top-2 z-10 max-w-[65%] text-base font-bold leading-tight tracking-wide text-[#f59e0b] [text-shadow:0_0_6px_rgba(15,23,42,0.9),0_0_10px_rgba(15,23,42,0.85),0_1px_2px_rgba(15,23,42,1)] sm:text-lg"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {cornerLabel}
          </div>
        )}
        {showControls && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
