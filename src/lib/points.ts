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
 * Tier-blind by design — any earned star counts the same toward this multiplier
 * regardless of which medal (see StarTier below) it came in as.
 */
const STAR_MULTIPLIERS = [1, 1.3, 1.6, 2] as const;

export function starMultiplier(starCount: number): number {
  return STAR_MULTIPLIERS[starCount] ?? 1;
}

/**
 * Which medal a category's star was earned as, based on the try it was correctly
 * answered on: 1st try = gold, 2nd = silver, 3rd = bronze. `null` means no star was
 * earned (wrong/skipped). A category with fewer than 3 max tries (capital: 2, flag: 1)
 * simply never reaches the lower tiers.
 */
export type StarTier = 'gold' | 'silver' | 'bronze' | null;

export function tierForTry(tryNumber: number): StarTier {
  if (tryNumber === 1) return 'gold';
  if (tryNumber === 2) return 'silver';
  if (tryNumber === 3) return 'bronze';
  return null;
}

const TIER_EMOJI: Record<Exclude<StarTier, null>, string> = {
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉',
};

/** Emoji for a tier, or a blank marker for "no star" — accepts undefined so old stored records without tier data degrade gracefully. Used for the shareable Copy-results text, which must stay Wordle-style (⬛ for a miss). */
export function tierEmoji(tier: StarTier | undefined): string {
  return tier ? TIER_EMOJI[tier] : '⬛';
}

/** Same as tierEmoji but for on-screen display: a miss renders as a red X instead of a black box. */
export function tierIcon(tier: StarTier | undefined): string {
  return tier ? TIER_EMOJI[tier] : '❌';
}
