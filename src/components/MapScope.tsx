import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { LatLng } from '../data/types';
import { WORLD_BORDERS_PATH, WORLD_MAP_PATH } from '../data/worldMap';

interface MapScopeProps {
  center: LatLng;
  zoom: number;
}

const WORLD_WIDTH = 1000;
const WORLD_HEIGHT = 500;
const CONTAINER_ASPECT = 16 / 9;
const MIN_ZOOM_FACTOR = 1.2;
const MAX_ZOOM_FACTOR = 40;
const WHEEL_ZOOM_STEP = 1.15;
const BUTTON_ZOOM_STEP = 1.5;
/** Borders only appear once zoomed in at least this far past the round's starting zoom. */
const BORDER_REVEAL_ZOOM_RATIO = 1.15;

function projectWorld(coord: LatLng): { x: number; y: number } {
  return {
    x: ((coord.lng + 180) / 360) * WORLD_WIDTH,
    y: ((90 - coord.lat) / 180) * WORLD_HEIGHT,
  };
}

function clampInitialZoom(zoom: number): number {
  return Math.min(Math.max(zoom, 1), 14) / 2;
}

function clampZoomFactor(zoomFactor: number): number {
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, zoomFactor));
}

/**
 * Interactive map scope: renders the world's coastline silhouette (always visible,
 * no political borders) and lets the player pan/zoom freely with mouse drag + wheel
 * (or the on-screen +/- buttons). Interior country border lines are drawn but kept
 * invisible until the player zooms in past the round's starting scope — see the
 * "no country borders shown by default" requirement in geo-game-instructions.md.
 * Both layers are static SVG paths baked at build time by
 * scripts/build-world-map.mjs (src/data/worldMap.ts) from Natural Earth's
 * public-domain 110m data, so no mapping library ships to the client.
 */
export function MapScope({ center, zoom }: MapScopeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);

  const pin = useMemo(() => projectWorld(center), [center.lat, center.lng]);
  const initialZoomFactor = useMemo(() => clampInitialZoom(zoom), [zoom]);

  const [zoomFactor, setZoomFactor] = useState(initialZoomFactor);
  const [camera, setCamera] = useState(() => ({ x: pin.x, y: pin.y }));

  // Reset the view whenever the target changes (new round/step).
  useEffect(() => {
    setZoomFactor(initialZoomFactor);
    setCamera({ x: pin.x, y: pin.y });
  }, [pin.x, pin.y, initialZoomFactor]);

  const visibleWidth = WORLD_WIDTH / zoomFactor;
  const visibleHeight = visibleWidth / CONTAINER_ASPECT;
  const viewBoxMinX = camera.x - visibleWidth / 2;
  const viewBoxMinY = camera.y - visibleHeight / 2;
  const viewBox = `${viewBoxMinX} ${viewBoxMinY} ${visibleWidth} ${visibleHeight}`;

  const showBorders = zoomFactor > initialZoomFactor * BORDER_REVEAL_ZOOM_RATIO;
  const pinXPercent = ((pin.x - viewBoxMinX) / visibleWidth) * 100;
  const pinYPercent = ((pin.y - viewBoxMinY) / visibleHeight) * 100;

  function clampCamera(x: number, y: number, vw: number, vh: number) {
    const marginX = vw / 2;
    const marginY = vh / 2;
    return {
      x: Math.min(WORLD_WIDTH + marginX, Math.max(-marginX, x)),
      y: Math.min(WORLD_HEIGHT + marginY, Math.max(-marginY, y)),
    };
  }

  function zoomBy(factor: number) {
    setZoomFactor((z) => clampZoomFactor(z * factor));
  }

  function resetView() {
    setZoomFactor(initialZoomFactor);
    setCamera({ x: pin.x, y: pin.y });
  }

  function handlePointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
  }

  function handlePointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragState.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== e.pointerId || !rect) return;

    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;

    const worldPerPixelX = visibleWidth / rect.width;
    const worldPerPixelY = visibleHeight / rect.height;
    setCamera((prev) =>
      clampCamera(prev.x - dx * worldPerPixelX, prev.y - dy * worldPerPixelY, visibleWidth, visibleHeight),
    );
  }

  function handlePointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    if (dragState.current?.pointerId === e.pointerId) dragState.current = null;
  }

  // Native (non-passive) wheel listener so we can preventDefault and stop page
  // scroll while zooming — React's onWheel is passive and can't do this.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full touch-none select-none overflow-hidden rounded-xl border border-slate-700 bg-sky-950"
    >
      <svg
        viewBox={viewBox}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <path d={WORLD_MAP_PATH} fill="#334155" fillRule="evenodd" />
        {showBorders && (
          <path
            d={WORLD_BORDERS_PATH}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={1}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.8}
          />
        )}
      </svg>

      <div
        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 ring-4 ring-rose-500/30"
        style={{ left: `${pinXPercent}%`, top: `${pinYPercent}%` }}
      />

      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => zoomBy(BUTTON_ZOOM_STEP)}
          className="flex h-7 w-7 items-center justify-center rounded bg-slate-800/80 text-slate-100 hover:bg-slate-700"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / BUTTON_ZOOM_STEP)}
          className="flex h-7 w-7 items-center justify-center rounded bg-slate-800/80 text-slate-100 hover:bg-slate-700"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      <button
        type="button"
        onClick={resetView}
        className="absolute bottom-2 left-2 rounded bg-slate-800/80 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-300 hover:bg-slate-700"
      >
        reset view
      </button>
    </div>
  );
}
