import { describe, expect, it } from 'vitest';
import { getCountryById } from '../../data/countries';
import { evaluateGame, createEmptyProfile } from '../achievements';
import { buildGameSummary, countryRoundSummary, fullRoundSummary, SKIPPED_GUESS } from '../gameSummaries';

const japan = getCountryById('jp')!;
const france = getCountryById('fr')!;

describe('countryRoundSummary', () => {
  it('maps a found country to one star and its score', () => {
    expect(countryRoundSummary(japan, { guess: 'Japan', score: 70, tier: 'silver' })).toEqual({
      countryId: 'jp',
      isIsland: true,
      tiers: { country: 'silver' },
      stars: 1,
      points: 70,
      skipped: false,
    });
  });

  it('marks a skip, and gives no star for a miss', () => {
    const skipped = countryRoundSummary(france, { guess: SKIPPED_GUESS, score: 0, tier: null });
    expect(skipped).toMatchObject({ skipped: true, stars: 0, isIsland: false });
    const wrong = countryRoundSummary(france, { guess: 'Spain', score: 0, tier: null });
    expect(wrong.skipped).toBe(false);
  });
});

describe('fullRoundSummary', () => {
  it('carries the three medals, stars and points across', () => {
    const summary = fullRoundSummary({
      country: japan,
      tiers: { country: 'gold', capital: 'silver', flag: null },
      stars: 2,
      points: 592,
      countryGuess: { guess: 'Japan' },
    });
    expect(summary.tiers).toEqual({ country: 'gold', capital: 'silver', flag: null });
    expect(summary).toMatchObject({ countryId: 'jp', isIsland: true, stars: 2, points: 592, skipped: false });
  });
});

describe('end to end with the engine', () => {
  it('a perfect daily built from round results earns Flawless and the top Big Score level', () => {
    const rounds = Array.from({ length: 7 }, () =>
      fullRoundSummary({
        country: france,
        tiers: { country: 'gold', capital: 'gold', flag: 'gold' },
        stars: 3,
        points: 1200,
        countryGuess: { guess: 'France' },
      }),
    );
    const result = evaluateGame(buildGameSummary({ kind: 'daily', rounds }), createEmptyProfile(), 1);
    const ids = result.earned.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['flawless-day', 'perfect-round', 'gold-standard', 'first-try']));
    expect(result.earned.find((e) => e.id === 'big-score')?.levelLabel).toBe('8K');
  });
});
