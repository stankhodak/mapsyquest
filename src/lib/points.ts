/**
 * Point weighting is provisional per the "Point weighting" note in
 * geo-game-instructions.md: capital is worth the most, country the least — but
 * without visible borders, country name may turn out to be the hardest category,
 * so this is flagged for revisiting after playtesting (may become
 * capital > country > flag instead). Kept as a plain config object so it's a
 * one-line change to retune.
 */
export const CATEGORY_WEIGHTS = {
  capital: 50,
  flag: 30,
  country: 20,
} as const;

export type ScoringCategory = keyof typeof CATEGORY_WEIGHTS;

/** Linear decay from 1.0 (instant) to 0.5 (at maxMs or slower). */
export function speedMultiplier(elapsedMs: number, maxMs = 20000): number {
  const clamped = Math.min(Math.max(elapsedMs, 0), maxMs);
  return 1 - (clamped / maxMs) * 0.5;
}

/** correctnessFraction is 0/1 for pass-fail categories (country, flag), or score/100 for capital. */
export function categoryPoints(
  category: ScoringCategory,
  correctnessFraction: number,
  elapsedMs: number,
): number {
  const weight = CATEGORY_WEIGHTS[category];
  return Math.round(weight * correctnessFraction * speedMultiplier(elapsedMs));
}
