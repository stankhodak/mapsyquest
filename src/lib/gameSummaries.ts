/**
 * Adapters from the game components' own result shapes to the achievement engine's
 * GameSummary. Kept structural (no component imports) so lib code never depends on UI.
 */
import type { Country } from '../data/types';
import type { GameSummary, RoundSummary } from './achievements';
import type { ChallengeKind, RegionId } from './challenges';
import type { StarTier } from './points';

/** The guess text a country round records when the player skips it. */
export const SKIPPED_GUESS = '(skipped)';

interface CountryGuessLike {
  guess: string;
  score: number;
  tier: StarTier;
}

/** A round where only the country was asked (quiz, time and flag games). */
export function countryRoundSummary(country: Country, result: CountryGuessLike): RoundSummary {
  return {
    countryId: country.id,
    isIsland: country.isIsland,
    tiers: { country: result.tier },
    stars: result.tier ? 1 : 0,
    points: result.score,
    skipped: result.guess === SKIPPED_GUESS,
  };
}

interface FullRoundLike {
  country: Country;
  tiers: { country: StarTier; capital: StarTier; flag: StarTier };
  stars: number;
  points: number;
  countryGuess: { guess: string };
}

/** A round with country, capital and flag (the daily and regional Full Rounds). */
export function fullRoundSummary(result: FullRoundLike): RoundSummary {
  return {
    countryId: result.country.id,
    isIsland: result.country.isIsland,
    tiers: result.tiers,
    stars: result.stars,
    points: result.points,
    skipped: result.countryGuess.guess === SKIPPED_GUESS,
  };
}

interface BuildGameOptions {
  kind: 'daily' | ChallengeKind;
  region?: RegionId;
  rounds: RoundSummary[];
  /** Time Challenge only. */
  timeSeconds?: number;
  penaltySeconds?: number;
}

export function buildGameSummary({ kind, region, rounds, timeSeconds, penaltySeconds }: BuildGameOptions): GameSummary {
  return { kind, region, rounds, timeSeconds, penaltySeconds };
}
