import { describe, expect, it } from 'vitest';
import {
  buildChallengeCountries,
  CHALLENGE_ROUNDS,
  formatChallengeTime,
  getRegionCountries,
  REGIONS,
  wrongGuessesForTier,
} from '../challenges';

describe('regions', () => {
  it.each(REGIONS)('$label has enough countries for the longest game', (region) => {
    const pool = getRegionCountries(region.id);
    expect(pool.length).toBeGreaterThanOrEqual(Math.max(...Object.values(CHALLENGE_ROUNDS)));
    expect(pool.every(region.matches)).toBe(true);
  });

  it('Islands contains only island nations', () => {
    expect(getRegionCountries('islands').every((c) => c.isIsland)).toBe(true);
  });
});

describe('buildChallengeCountries', () => {
  it.each(REGIONS)('regional games for $label stay in the region with no repeats', (region) => {
    for (const kind of ['regional-full', 'regional-quiz'] as const) {
      const picked = buildChallengeCountries({ kind, region: region.id });
      expect(picked).toHaveLength(CHALLENGE_ROUNDS[kind]);
      expect(new Set(picked.map((c) => c.id)).size).toBe(picked.length);
      expect(picked.every(region.matches)).toBe(true);
    }
  });

  it('time and flag games draw ten unique countries from the whole world', () => {
    for (const kind of ['time', 'flag'] as const) {
      const picked = buildChallengeCountries({ kind });
      expect(picked).toHaveLength(10);
      expect(new Set(picked.map((c) => c.id)).size).toBe(10);
    }
  });

  it('keeps the daily island caps in the time challenge', () => {
    for (let i = 0; i < 50; i++) {
      const picked = buildChallengeCountries({ kind: 'time' });
      expect(picked.filter((c) => c.isIsland).length).toBeLessThanOrEqual(2);
      expect(picked.filter((c) => c.isVerySmallIsland).length).toBeLessThanOrEqual(1);
    }
  });

  it('does not cap islands in the Islands region', () => {
    const picked = buildChallengeCountries({ kind: 'regional-quiz', region: 'islands' });
    expect(picked).toHaveLength(10);
  });
});

describe('wrongGuessesForTier', () => {
  it('maps each medal to the number of wrong guesses before it', () => {
    expect(wrongGuessesForTier('gold')).toBe(0);
    expect(wrongGuessesForTier('silver')).toBe(1);
    expect(wrongGuessesForTier('bronze')).toBe(2);
  });

  it('counts a failed or skipped round as all three tries', () => {
    expect(wrongGuessesForTier(null)).toBe(3);
  });
});

describe('formatChallengeTime', () => {
  it('formats minutes, seconds and tenths', () => {
    expect(formatChallengeTime(83.4)).toBe('1:23.4');
    expect(formatChallengeTime(5.04)).toBe('0:05.0');
    expect(formatChallengeTime(0)).toBe('0:00.0');
  });

  it('carries into the next minute instead of showing 60 seconds', () => {
    expect(formatChallengeTime(59.96)).toBe('1:00.0');
  });
});
