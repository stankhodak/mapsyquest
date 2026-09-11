import type { LatLng } from '../data/types';

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
 * Placeholder map scope: an equirectangular graticule (no real tiles/borders) with
 * a pin at the target coordinates, "zoomed" via CSS transform scaled around the
 * pin. Stands in for the real original map renderer called for in
 * geo-game-instructions.md — swap the graticule for actual map rendering later.
 */
export function MapScope({ center, zoom }: MapScopeProps) {
  const { x, y } = project(center);
  const scale = Math.min(Math.max(zoom, 1), 14) / 2;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.25) 1px, transparent 1px)',
          backgroundSize: '8.3333% 16.6667%',
          transformOrigin: `${x}% ${y}%`,
          transform: `scale(${scale})`,
        }}
      />
      <div
        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 ring-4 ring-rose-500/30"
        style={{ left: `${x}%`, top: `${y}%` }}
      />
      <span className="absolute bottom-1 right-2 text-[10px] uppercase tracking-wide text-slate-500">
        map scope placeholder
      </span>
    </div>
  );
}
