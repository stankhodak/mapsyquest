import { countries } from '../data/countries';
import type { Country } from '../data/types';

const ROUNDS_PER_DAY = 7;
/** Islands (no land borders — see build-countries.mjs) are harder to place without
 * neighbouring-country landmarks, so a single day caps how many can appear. */
const MAX_ISLANDS_PER_DAY = 2;
/** Stricter sub-cap within MAX_ISLANDS_PER_DAY for very small islands (Nauru, Tuvalu, etc.). */
const MAX_VERY_SMALL_ISLANDS_PER_DAY = 1;

/** Deterministic PRNG seeded from a number, so the same date always yields the same round order. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromDateKey(dateKey: string): number {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (Math.imul(31, hash) + dateKey.charCodeAt(i)) | 0;
  }
  return hash;
}

/** YYYY-MM-DD in the local timezone. */
export function todayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Milliseconds until local midnight — when the next day's challenge unlocks. */
export function msUntilNextDay(now: Date = new Date()): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return nextMidnight.getTime() - now.getTime();
}

/** A country isn't picked again until this many days after it last appeared. */
export const LOOKBACK_DAYS = 14;
/** The day the no-repeat history starts from. Each day's pick depends on the days before it,
 * so it has to be built forward from a fixed point; dates before it get the plain seeded pick. */
const LOOKBACK_EPOCH = '2026-09-01';
/** Guards the forward build against an absurd date (e.g. a clock set centuries ahead). */
const MAX_LOOKBACK_SPAN_DAYS = 5000;

function shuffledPoolFor(dateKey: string): Country[] {
  const rng = mulberry32(seedFromDateKey(dateKey));
  const pool = [...countries];

  // Fisher-Yates shuffle using the seeded RNG.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function dateKeyMs(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Whole days from one date key to another (negative if `to` is earlier). */
function daysBetween(from: string, to: string): number {
  return Math.round((dateKeyMs(to) - dateKeyMs(from)) / 86_400_000);
}

function dateKeyAtDay(dayIndex: number): string {
  const d = new Date(dateKeyMs(LOOKBACK_EPOCH) + dayIndex * 86_400_000);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

/**
 * Like selectWithIslandCaps, but countries seen in the last `lookbackDays` days go to the back
 * of the queue (least recently seen first), so they're only reached if the fresh countries
 * can't fill the day under the island caps. `lastSeen` maps a country id to the day index it
 * last appeared on.
 */
export function selectWithLookback(
  shuffledPool: Country[],
  lastSeen: ReadonlyMap<string, number>,
  dayIndex: number,
  lookbackDays: number,
  count: number,
): Country[] {
  const fresh: Country[] = [];
  const recent: Country[] = [];
  for (const country of shuffledPool) {
    const seen = lastSeen.get(country.id);
    (seen !== undefined && dayIndex - seen < lookbackDays ? recent : fresh).push(country);
  }
  recent.sort((a, b) => lastSeen.get(a.id)! - lastSeen.get(b.id)!);
  return selectWithIslandCaps([...fresh, ...recent], count);
}

// Picks for LOOKBACK_EPOCH + i days, built forward on demand and kept for the session.
const pickHistory: Country[][] = [];
const lastSeenDay = new Map<string, number>();

function extendHistoryThrough(dayIndex: number): void {
  while (pickHistory.length <= dayIndex) {
    const i = pickHistory.length;
    const picks = selectWithLookback(shuffledPoolFor(dateKeyAtDay(i)), lastSeenDay, i, LOOKBACK_DAYS, ROUNDS_PER_DAY);
    for (const country of picks) lastSeenDay.set(country.id, i);
    pickHistory.push(picks);
  }
}

/** Selects this day's 7 countries, deterministic per date key, with none repeating from the previous LOOKBACK_DAYS days. */
export function getDailyCountries(dateKey: string = todayKey()): Country[] {
  const dayIndex = daysBetween(LOOKBACK_EPOCH, dateKey);
  if (!Number.isFinite(dayIndex) || dayIndex < 0 || dayIndex > MAX_LOOKBACK_SPAN_DAYS) {
    return selectWithIslandCaps(shuffledPoolFor(dateKey), ROUNDS_PER_DAY);
  }
  extendHistoryThrough(dayIndex);
  return [...pickHistory[dayIndex]];
}

/**
 * Walks an already-shuffled pool, skipping countries that would push either island cap
 * over its limit — keeps the selection deterministic while keeping a single game from
 * stacking up on hard-to-place islands. Shared with the non-daily challenges.
 */
export function selectWithIslandCaps(shuffledPool: Country[], count: number): Country[] {
  const selected: Country[] = [];
  let islandCount = 0;
  let verySmallIslandCount = 0;
  for (const country of shuffledPool) {
    if (selected.length >= count) break;
    if (country.isVerySmallIsland && verySmallIslandCount >= MAX_VERY_SMALL_ISLANDS_PER_DAY) continue;
    if (country.isIsland && islandCount >= MAX_ISLANDS_PER_DAY) continue;
    selected.push(country);
    if (country.isIsland) islandCount++;
    if (country.isVerySmallIsland) verySmallIslandCount++;
  }
  return selected;
}
