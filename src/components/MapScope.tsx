import { useEffect, useRef } from 'react';
import { AttributionControl, Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
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
}

// OpenFreeMap: free vector tiles, no API key, ODbL-licensed OpenStreetMap data.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
// admin_level boundary layers in the "liberty" style (country, region, disputed).
const BORDER_LAYER_IDS = ['boundary_2', 'boundary_3', 'boundary_disputed'];
/** Borders only appear once zoomed in this many levels past the round's starting zoom. */
const BORDER_REVEAL_ZOOM_DELTA = 1.2;
const MIN_MAP_ZOOM = 1;
const MAX_MAP_ZOOM = 16;

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

/**
 * Interactive map scope built on MapLibre GL with free OpenFreeMap vector tiles
 * (a real-world basemap, no API key/account needed). All text and icon labels
 * (place names, POIs, road shields) are permanently hidden since they'd give away
 * the country/capital answer outright. Country and admin borders are hidden by
 * default and only appear once the player zooms in noticeably past the round's
 * starting scope, mirroring the "no country borders shown by default" requirement
 * in geo-game-instructions.md.
 */
export function MapScope({ center, zoom }: MapScopeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);

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
    map.addControl(new AttributionControl({ compact: true }), 'top-right');

    map.once('style.load', () => {
      hideAllLabels(map);
      revealBordersPast(map, zoom);
    });

    markerRef.current = new Marker({ color: '#f43f5e' }).setLngLat([center.lng, center.lat]).addTo(map);
    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Each round/step renders its own MapScope instance (see RoundFlow's per-round `key`
    // and CountryStep/CapitalStep/FlagStep being distinct components), so center/zoom
    // are only ever read once at construction — no need to react to prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetView() {
    mapRef.current?.jumpTo({ center: [center.lng, center.lat], zoom });
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full touch-none select-none overflow-hidden rounded-xl border border-slate-700 bg-sky-950"
    >
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
  );
}
