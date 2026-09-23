// One-off build-time data prep: generates src/data/countries.ts and copies flag
// SVGs into public/flags/. Run with `node scripts/build-countries.mjs` if the
// source list ever needs regenerating. All source packages are devDependencies
// only — nothing here ships to the client at runtime.
//
// Sources:
// - world-countries (mledoze/countries, public domain-style open dataset): name,
//   capital, region, country centroid (latlng), area.
// - all-the-cities (GeoNames-derived, public domain): capital city coordinates,
//   matched to world-countries by ISO 3166-1 alpha-2 code via each city's
//   featureCode === 'PPLC' ("capital of a political entity").
//
// Scope: countries world-countries flags as unMember, unioned with Vatican City
// explicitly (it's ISO 3166-1 assigned and the explicit small-country example in
// geo-game-instructions.md) as a safety net in case the dataset's unMember flag
// for it — which, as of this dataset version, is actually true — ever changes.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import worldCountries from 'world-countries';
import cities from 'all-the-cities';
import * as topojson from 'topojson-client';
import countriesTopology from 'world-atlas/countries-50m.json' with { type: 'json' };

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLAG_SOURCE_DIR = path.join(ROOT, 'node_modules', 'country-flag-icons', '3x2');
const FLAG_OUT_DIR = path.join(ROOT, 'public', 'flags');
const COUNTRIES_OUT_PATH = path.join(ROOT, 'src', 'data', 'countries.ts');

// Hand-picked microstates with very few towns of any size — see the small-country
// fallback note in geo-game-instructions.md. Not derived from a dataset field
// since "settlement count" isn't reliably available, and this flag isn't yet
// wired into the round flow, so precision here isn't gameplay-critical.
const FEW_SETTLEMENTS = new Set(['va', 'mc', 'sm', 'li', 'nr', 'tv']);

// A country with zero land borders (world-countries' `borders` list) is, in
// practice, an island nation — used by the daily-quest generator to cap how many
// islands (harder to place without land-border landmarks) appear in one day.
// Below this land area, an island counts as "very small" and gets a tighter cap.
const VERY_SMALL_ISLAND_AREA_KM2 = 2000;

// Manual overrides for capitals GeoNames doesn't tag PPLC for (politically
// sensitive cases, mainly).
const CAPITAL_COORD_OVERRIDES = {
  il: { lat: 31.7683, lng: 35.2137 }, // Jerusalem
};

const capitalsByIso = new Map();
for (const city of cities) {
  if (city.featureCode !== 'PPLC') continue;
  const iso = city.country.toLowerCase();
  if (!capitalsByIso.has(iso)) {
    capitalsByIso.set(iso, { lat: city.loc.coordinates[1], lng: city.loc.coordinates[0] });
  }
}

// world-countries' `latlng` is a hand-picked centroid that, for split/archipelago
// countries (e.g. Equatorial Guinea's mainland + Bioko island), can land in open
// water between landmasses — see the "map pin sits in the water" bug report. To
// guarantee the country-step map pin sits on actual land, we instead compute a
// centroid from the real admin-0 polygon geometry (same source as
// build-country-shapes.mjs), restricted to the country's single largest landmass.

/**
 * Countries/landmasses straddling the antimeridian (Fiji, Kiribati) have rings
 * whose longitudes flip between ~180 and ~-180, which breaks the area/centroid
 * math below (it treats the ring as spanning the entire globe). Detect that and
 * shift negative longitudes by +360 so the ring is contiguous; the caller wraps
 * the final result back into [-180, 180] with wrapLng.
 */
function unwrapRingLongitudes(ring) {
  const lngs = ring.map(([lng]) => lng);
  const spread = Math.max(...lngs) - Math.min(...lngs);
  if (spread <= 180) return ring;
  return ring.map(([lng, lat]) => [lng < 0 ? lng + 360 : lng, lat]);
}

function wrapLng(lng) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/** Area-weighted polygon centroid (the "center of mass" of the ring's interior). */
function ringCentroid(ring) {
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-12) {
    const n = ring.length;
    const sum = ring.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    return [sum[0] / n, sum[1] / n];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

/** Ray-casting point-in-polygon test against a single ring. */
function pointInRing([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Smallest angular distance between two longitudes, wrapping around the antimeridian
 * (e.g. 179 and -179 are 2° apart, not 358°). */
function lngDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Distance from the capital to a landmass: 0 when the capital sits on it, otherwise
 * the distance to its nearest boundary vertex. Measuring to the landmass itself, not
 * its centroid, matters for small exclaves: Oman's Madha exclave (inside the UAE)
 * has a centroid nearer Muscat than mainland Oman's centroid is, which put Oman's
 * country-step pin in the middle of the UAE.
 */
function distanceToRing(capital, ring) {
  const unwrappedLng = ring.some(([lng]) => lng > 180) && capital.lng < 0 ? capital.lng + 360 : capital.lng;
  if (pointInRing([unwrappedLng, capital.lat], ring)) return 0;
  let best = Infinity;
  for (const [lng, lat] of ring) {
    best = Math.min(best, Math.hypot(lngDistance(wrapLng(lng), capital.lng), lat - capital.lat));
  }
  return best;
}

/**
 * The (antimeridian-unwrapped) outer ring of whichever polygon part sits closest to
 * the capital — NOT necessarily the largest landmass. For split-territory countries
 * (Equatorial Guinea's Bioko vs. mainland Río Muni; Kiribati's Gilbert vs. Line
 * Islands, thousands of km apart) the capital's own island is what the capital/flag
 * steps actually frame, so the country name label needs to land there too — picking
 * the largest piece instead could put the label (and, previously, the country-step
 * pin) on a totally different, far-off island. See the "country name off screen"
 * report for Kiribati's capital step.
 */
function nearestOuterRingToCapital(geometry, capital) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let best = null;
  let bestDist = Infinity;
  for (const polygonCoords of polygons) {
    const ring = unwrapRingLongitudes(polygonCoords[0]);
    const dist = distanceToRing(capital, ring);
    if (dist < bestDist) {
      bestDist = dist;
      best = ring;
    }
  }
  return best;
}

/**
 * A point guaranteed to sit on the country's landmass closest to its capital: the
 * area centroid of that landmass's outer ring, falling back to the vertex average,
 * then a boundary vertex, for the rare concave shape where the centroid itself
 * lands outside the ring.
 */
function computeLandCenter(geometry, capital) {
  const outerRing = nearestOuterRingToCapital(geometry, capital);
  const centroid = ringCentroid(outerRing);
  let point = centroid;

  if (!pointInRing(point, outerRing)) {
    const n = outerRing.length;
    const sum = outerRing.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    const vertexAverage = [sum[0] / n, sum[1] / n];
    point = pointInRing(vertexAverage, outerRing) ? vertexAverage : outerRing[0];
  }

  return { lat: point[1], lng: wrapLng(point[0]) };
}

const countryGeometries = countriesTopology.objects.countries.geometries;
function landCenterFor(ccn3, capital) {
  const geom = countryGeometries.find((g) => g.id === ccn3);
  if (!geom) return null;
  const feature = topojson.feature(countriesTopology, { type: 'GeometryCollection', geometries: [geom] });
  const geometry = feature.features ? feature.features[0].geometry : feature.geometry;
  const { lat, lng } = computeLandCenter(geometry, capital);
  return { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
}

function estimateMapZoom(areaKm2) {
  const area = Math.max(areaKm2, 0.1);
  const zoom = 12.5 - 1.45 * Math.log10(area);
  return Math.round(Math.min(14, Math.max(2, zoom)));
}

function toCountryRecord(source) {
  const id = source.cca2.toLowerCase();
  const capitalCoords = CAPITAL_COORD_OVERRIDES[id] ?? capitalsByIso.get(id);
  if (!capitalCoords) {
    throw new Error(`No capital coordinates found for ${source.name.common} (${id})`);
  }
  const isIsland = !source.borders || source.borders.length === 0;
  return {
    id,
    name: source.name.common,
    capital: source.capital[0],
    region: source.region,
    center: landCenterFor(source.ccn3, capitalCoords) ?? { lat: source.latlng[0], lng: source.latlng[1] },
    capitalCoords,
    mapZoom: estimateMapZoom(source.area),
    settlementCount: FEW_SETTLEMENTS.has(id) ? 'few' : 'many',
    isIsland,
    isVerySmallIsland: isIsland && source.area < VERY_SMALL_ISLAND_AREA_KM2,
  };
}

const vatican = worldCountries.find((c) => c.cca2 === 'VA');
const sourceById = new Map();
for (const c of [...worldCountries.filter((c) => c.unMember), vatican]) {
  sourceById.set(c.cca2, c);
}
const records = [...sourceById.values()]
  .map(toCountryRecord)
  .sort((a, b) => a.name.localeCompare(b.name));

// --- Write src/data/countries.ts ---

function formatRecord(r) {
  return `  { id: '${r.id}', name: ${JSON.stringify(r.name)}, capital: ${JSON.stringify(r.capital)}, region: ${JSON.stringify(r.region)}, center: { lat: ${r.center.lat}, lng: ${r.center.lng} }, capitalCoords: { lat: ${r.capitalCoords.lat}, lng: ${r.capitalCoords.lng} }, mapZoom: ${r.mapZoom}, settlementCount: '${r.settlementCount}', isIsland: ${r.isIsland}, isVerySmallIsland: ${r.isVerySmallIsland} },`;
}

const countriesOutput = `// Generated by scripts/build-countries.mjs — do not edit by hand.
// Source: world-countries (unMember-flagged entries, unioned with Vatican City),
// with capital coordinates from all-the-cities (GeoNames PPLC entries). See the
// script for details and manual overrides.
import type { Country } from './types';

export const countries: Country[] = [
${records.map(formatRecord).join('\n')}
];

export function getCountryById(id: string): Country | undefined {
  return countries.find((c) => c.id === id);
}
`;

writeFileSync(COUNTRIES_OUT_PATH, countriesOutput);
console.log(`Wrote ${COUNTRIES_OUT_PATH} (${records.length} countries)`);

// --- Copy flag SVGs into public/flags/ ---

mkdirSync(FLAG_OUT_DIR, { recursive: true });
let copied = 0;
for (const r of records) {
  const src = path.join(FLAG_SOURCE_DIR, `${r.id.toUpperCase()}.svg`);
  const dest = path.join(FLAG_OUT_DIR, `${r.id}.svg`);
  if (!existsSync(src)) {
    throw new Error(`No flag SVG found for ${r.name} (${r.id})`);
  }
  copyFileSync(src, dest);
  copied++;
}
console.log(`Copied ${copied} flag SVGs to ${FLAG_OUT_DIR}`);
