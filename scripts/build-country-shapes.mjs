// One-off build-time data prep: generates a simplified, per-country outline dataset
// (fill polygon + real bounding box — padding is applied at runtime, see MapScope.tsx)
// from world-atlas's admin-0 topology, matched
// to our own country roster (world-countries, unMember + Vatican) via ISO numeric
// (ccn3) codes. Used for the red-flash-on-wrong-guess and country-outline-hint
// features described in geo-game-instructions.md. Run with
// `node scripts/build-country-shapes.mjs` if the source list or simplification level
// ever needs regenerating. All source packages are devDependencies only — the
// generated dataset ships as its own lazy-loaded chunk (see MapScope.tsx), not the
// main bundle.
//
// One small country (Tuvalu) has no usable shape even at this resolution and is
// simply omitted — consumers should treat a missing lookup as "no shape available"
// and fall back to the existing zoom behaviour.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as topojson from 'topojson-client';
import { filter, filterAttached, presimplify, quantile, simplify } from 'topojson-simplify';
import worldCountries from 'world-countries';
import countriesTopology from 'world-atlas/countries-50m.json' with { type: 'json' };

// Chosen empirically: keeps shapes recognisable at a ~250KB total payload with zero
// degenerate (sub-triangle) polygons for most of the roster.
const SIMPLIFY_QUANTILE = 0.15;
const COORD_DECIMALS = 2;
// A single global simplification threshold strips away almost every vertex of a
// tiny country's coastline (San Marino, Vatican City, Nauru, Singapore, ...),
// collapsing it to a degenerate single-point "shape" — see the small-country map
// glitch report. Below this land area, skip simplification and round to finer
// precision instead, using the untouched topology so the shape survives.
const SMALL_AREA_KM2 = 3000;
const SMALL_COORD_DECIMALS = 4;

// Kept pristine (pre-simplification) for small-country extraction, since presimplify
// mutates arc points in place.
const rawTopology = structuredClone(countriesTopology);

let topo = presimplify(countriesTopology);
topo = simplify(topo, quantile(topo, SIMPLIFY_QUANTILE));
topo = filter(topo, filterAttached(topo));

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function roundCoords(coords, decimals) {
  if (typeof coords[0] === 'number') return coords.map((v) => round(v, decimals));
  return coords.map((c) => roundCoords(c, decimals));
}

/** Unwraps a ring's longitudes so consecutive points never jump by more than 180°,
 * fixing the classic antimeridian rendering bug: a ring that crosses ±180° without
 * being split (as several of Russia's and Fiji's do, after simplification stitches
 * arcs across the dateline) gets filled the "long way" around the globe by any
 * WebGL/vector renderer that takes coordinates literally — see the "Russia flashes
 * red across the whole map" report. */
function unwrapRing(ring) {
  const out = [ring[0].slice()];
  let offset = 0;
  for (let i = 1; i < ring.length; i++) {
    const prevLng = out[i - 1][0];
    let lng = ring[i][0] + offset;
    if (lng - prevLng > 180) {
      offset -= 360;
      lng -= 360;
    } else if (prevLng - lng > 180) {
      offset += 360;
      lng += 360;
    }
    out.push([lng, ring[i][1]]);
  }
  return out;
}

/** After each ring is internally contiguous, separate ring "pieces" of the same
 * MultiPolygon (e.g. Chukotka's islands vs. mainland Siberia) can still sit on
 * opposite numeric sides of the antimeridian. Shifts every ring by whole 360° steps
 * so it lands next to the largest (most-vertices) ring, giving both a correct,
 * compact bounding box and a geometry that renders as one contiguous landmass. */
function alignAntimeridian(geometry) {
  const isMulti = geometry.type === 'MultiPolygon';
  const polygons = isMulti ? geometry.coordinates : [geometry.coordinates];
  const unwrapped = polygons.map((poly) => poly.map(unwrapRing));

  let reference = null;
  let bestSize = -1;
  for (const poly of unwrapped) {
    for (const ring of poly) {
      if (ring.length > bestSize) {
        bestSize = ring.length;
        reference = ring[0][0];
      }
    }
  }

  const aligned = unwrapped.map((poly) =>
    poly.map((ring) => {
      const k = Math.round((reference - ring[0][0]) / 360);
      if (k === 0) return ring;
      return ring.map(([lng, lat]) => [lng + k * 360, lat]);
    }),
  );

  return { type: geometry.type, coordinates: isMulti ? aligned : aligned[0] };
}

function boundingBox(geometry, decimals) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  function visit(coords, depth) {
    if (depth === 0) {
      const [lng, lat] = coords;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      return;
    }
    for (const c of coords) visit(c, depth - 1);
  }

  visit(geometry.coordinates, geometry.type === 'Polygon' ? 2 : 3);
  return [round(west, decimals), round(south, decimals), round(east, decimals), round(north, decimals)];
}

const simplifiedGeometries = topo.objects.countries.geometries;
const rawGeometries = rawTopology.objects.countries.geometries;
const roster = [...worldCountries.filter((c) => c.unMember), worldCountries.find((c) => c.cca2 === 'VA')];

// Natural Earth's 50m Vatican is a ~1 km box centred ~1.9 km west of the real city-state, so
// its outline sat off the capital pin. world-countries' own Vatican polygon is in the right place.
const vaticanGeometry = JSON.parse(
  readFileSync(new URL('../node_modules/world-countries/data/vat.geo.json', import.meta.url), 'utf8'),
).features[0].geometry;

const shapes = {};
const missing = [];
for (const c of roster) {
  if (c.cca2 === 'VA') {
    const geometry = { type: vaticanGeometry.type, coordinates: roundCoords(vaticanGeometry.coordinates, SMALL_COORD_DECIMALS) };
    shapes.va = { bbox: boundingBox(geometry, SMALL_COORD_DECIMALS), geometry };
    continue;
  }
  // Tiny countries lose their shape entirely under the global simplification
  // threshold (see SMALL_AREA_KM2 above), so they're extracted from the
  // untouched topology instead, at finer coordinate precision.
  const isSmall = c.area < SMALL_AREA_KM2;
  const sourceTopo = isSmall ? rawTopology : topo;
  const geom = (isSmall ? rawGeometries : simplifiedGeometries).find((g) => g.id === c.ccn3);
  if (!geom) {
    missing.push(c.cca2);
    continue;
  }
  const fc = topojson.feature(sourceTopo, { type: 'GeometryCollection', geometries: [geom] });
  const feature = fc.features ? fc.features[0] : fc;
  const aligned = alignAntimeridian(feature.geometry);
  const decimals = isSmall ? SMALL_COORD_DECIMALS : COORD_DECIMALS;
  const geometry = { type: aligned.type, coordinates: roundCoords(aligned.coordinates, decimals) };
  shapes[c.cca2.toLowerCase()] = {
    bbox: boundingBox(geometry, decimals),
    geometry,
  };
}

const output = `// Generated by scripts/build-country-shapes.mjs — do not edit by hand.
// Source: Natural Earth 50m admin-0 boundaries (public domain), via world-atlas,
// simplified with topojson-simplify and matched to our roster via world-countries'
// ISO numeric (ccn3) code. Lazy-loaded (see MapScope.tsx) so it doesn't bloat the
// main bundle. Countries not present here have no shape data at this resolution —
// treat a missing lookup as "no outline available" (currently just: ${missing.join(', ') || 'none'}).
export interface CountryShape {
  /** [west, south, east, north] — the real (unpadded) extent; callers add their own margin. */
  bbox: [number, number, number, number];
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}

export const countryShapes: Record<string, CountryShape> = ${JSON.stringify(shapes)};
`;

const outPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data',
  'countryShapes.generated.ts',
);
writeFileSync(outPath, output);
console.log(
  `Wrote ${outPath} (${(output.length / 1024).toFixed(0)} KB, ${Object.keys(shapes).length} countries, missing: ${missing.join(', ') || 'none'})`,
);
