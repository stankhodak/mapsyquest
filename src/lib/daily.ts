import { countries } from '../data/countries';
import type { Country } from '../data/types';

const ROUNDS_PER_DAY = 7;

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

/** Selects this day's 7 countries, deterministic per date key. */
export function getDailyCountries(dateKey: string = todayKey()): Country[] {
  const rng = mulberry32(seedFromDateKey(dateKey));
  const pool = [...countries];

  // Fisher-Yates shuffle using the seeded RNG.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, ROUNDS_PER_DAY);
}
