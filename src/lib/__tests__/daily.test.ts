import { describe, expect, it } from 'vitest';
import type { Country } from '../../data/types';
import { getDailyCountries, LOOKBACK_DAYS, selectWithLookback } from '../daily';

function country(id: string, overrides: Partial<Country> = {}): Country {
  return {
    id,
    name: id,
    capital: id,
    region: 'Europe',
    center: { lat: 0, lng: 0 },
    capitalCoords: { lat: 0, lng: 0 },
    mapZoom: 5,
    settlementCount: 'many',
    isIsland: false,
    isVerySmallIsland: false,
    ...overrides,
  };
}

/** YYYY-MM-DD for `days` after 2026-09-01 (the lookback's start date). */
function dayAfterEpoch(days: number): string {
  return new Date(Date.UTC(2026, 8, 1 + days)).toISOString().slice(0, 10);
}

describe('getDailyCountries', () => {
  it('gives the same 7 distinct countries for the same date', () => {
    const first = getDailyCountries('2026-10-05');
    expect(first).toHaveLength(7);
    expect(new Set(first.map((c) => c.id)).size).toBe(7);
    expect(getDailyCountries('2026-10-05').map((c) => c.id)).toEqual(first.map((c) => c.id));
  });

  it('does not depend on the order dates are asked for', () => {
    const later = getDailyCountries(dayAfterEpoch(40)).map((c) => c.id);
    getDailyCountries(dayAfterEpoch(3));
    expect(getDailyCountries(dayAfterEpoch(40)).map((c) => c.id)).toEqual(later);
  });

  it(`never repeats a country within ${LOOKBACK_DAYS} days`, () => {
    const days = Array.from({ length: 200 }, (_, i) => getDailyCountries(dayAfterEpoch(i)).map((c) => c.id));
    days.forEach((ids, i) => {
      const earlier = new Set(days.slice(Math.max(0, i - (LOOKBACK_DAYS - 1)), i).flat());
      for (const id of ids) expect(earlier.has(id), `${id} on day ${i}`).toBe(false);
    });
  });

  it('keeps the island caps', () => {
    for (let i = 0; i < 100; i++) {
      const picks = getDailyCountries(dayAfterEpoch(i));
      expect(picks.filter((c) => c.isIsland).length).toBeLessThanOrEqual(2);
      expect(picks.filter((c) => c.isVerySmallIsland).length).toBeLessThanOrEqual(1);
    }
  });

  it('still picks 7 for dates before the lookback starts', () => {
    const picks = getDailyCountries('2026-01-15');
    expect(picks).toHaveLength(7);
    expect(getDailyCountries('2026-01-15').map((c) => c.id)).toEqual(picks.map((c) => c.id));
  });
});

describe('selectWithLookback', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => country(id));

  it('prefers countries not seen recently, keeping their order', () => {
    const lastSeen = new Map([['a', 9], ['b', 8]]);
    expect(selectWithLookback(pool, lastSeen, 10, 14, 3).map((c) => c.id)).toEqual(['c', 'd', 'e']);
  });

  it('treats a country as fresh again exactly LOOKBACK_DAYS days later', () => {
    const lastSeen = new Map([['a', 0]]);
    expect(selectWithLookback(pool, lastSeen, 13, 14, 6).map((c) => c.id).at(-1)).toBe('a');
    expect(selectWithLookback(pool, lastSeen, 14, 14, 6).map((c) => c.id)[0]).toBe('a');
  });

  it('falls back to the least recently seen when the fresh ones run out', () => {
    const lastSeen = new Map([['a', 9], ['b', 3], ['c', 7], ['d', 5]]);
    // Only e and f are fresh; the other 3 come from b (3), d (5), c (7) - oldest first.
    expect(selectWithLookback(pool, lastSeen, 10, 14, 5).map((c) => c.id)).toEqual(['e', 'f', 'b', 'd', 'c']);
  });

  it('still applies the island caps while falling back', () => {
    const islands = ['i1', 'i2', 'i3'].map((id) => country(id, { isIsland: true }));
    const lastSeen = new Map([['i1', 1], ['i2', 2], ['i3', 3], ['a', 4]]);
    const picks = selectWithLookback([...islands, country('a')], lastSeen, 5, 14, 4);
    expect(picks.filter((c) => c.isIsland)).toHaveLength(2);
  });
});
