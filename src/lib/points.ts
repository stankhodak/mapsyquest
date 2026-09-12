/**
 * Max score per category, each earned over up to 3 tries. Order (capital > flag >
 * country) mirrors the original weighting note in geo-game-instructions.md.
 */
export const MAX_SCORE = {
  country: 100,
  flag: 200,
  capital: 300,
} as const;

export type ScoringCategory = keyof typeof MAX_SCORE;

/** Fraction of max score awarded per try (1st/2nd/3rd): flat -30 percentage points per try. */
const TRY_FRACTIONS = [1, 0.7, 0.4] as const;

export function tryFraction(tryNumber: number): number {
  return TRY_FRACTIONS[tryNumber - 1] ?? 0;
}

/**
 * Star-count multiplier applied to a round's total score: +30% per star, with the
 * 3-star case rounded up to a clean 2x ("a perfect round doubles your score").
 */
const STAR_MULTIPLIERS = [1, 1.3, 1.6, 2] as const;

export function starMultiplier(starCount: number): number {
  return STAR_MULTIPLIERS[starCount] ?? 1;
}
