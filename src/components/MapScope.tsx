import type { LatLng } from '../data/types';
import { WORLD_MAP_PATH, WORLD_MAP_VIEWBOX } from '../data/worldMap';

interface MapScopeProps {
  center: LatLng;
  zoom: number;
}

function project(coord: LatLng): { x: number; y: number } {
  const x = ((coord.lng + 180) / 360) * 100;
  const y = ((90 - coord.lat) / 180) * 100;
  return { x, y };
}

/**
 * Map scope: renders the world's coastline silhouette (Natural Earth 110m land
 * layer, baked to a static SVG path by scripts/build-world-map.mjs — see
 * src/data/worldMap.ts) and zooms via a CSS transform scaled around the target
 * coordinate. Deliberately shows landmass only, no political borders, per the
 * "no country borders shown by default" requirement in geo-game-instructions.md.
 */
export function MapScope({ center, zoom }: MapScopeProps) {
  const { x, y } = project(center);
  const scale = Math.min(Math.max(zoom, 1), 14) / 2;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-700 bg-sky-950">
      <svg
        viewBox={WORLD_MAP_VIEWBOX}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        style={{
          transformOrigin: `${x}% ${y}%`,
          transform: `scale(${scale})`,
        }}
      >
        <path d={WORLD_MAP_PATH} fill="#334155" fillRule="evenodd" />
      </svg>
      <div
        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 ring-4 ring-rose-500/30"
        style={{ left: `${x}%`, top: `${y}%` }}
      />
    </div>
  );
}
