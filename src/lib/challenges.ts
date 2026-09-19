import { countries } from '../data/countries';
import type { Country } from '../data/types';
import { selectWithIslandCaps } from './daily';
import type { StarTier } from './points';

export type RegionId = 'europe' | 'asia' | 'americas' | 'oceania' | 'islands';

export interface RegionConfig {
  id: RegionId;
  label: string;
  emoji: string;
  matches: (country: Country) => boolean;
  /**
   * Whether a game keeps the daily island caps. Off for Oceania and Islands, where
   * nearly every country is an island and the caps would leave too few to pick from.
   */
  capIslands: boolean;
}

export const REGIONS: RegionConfig[] = [
  { id: 'europe', label: 'Europe', emoji: '🏰', matches: (c) => c.region === 'Europe', capIslands: true },
  { id: 'asia', label: 'Asia', emoji: '🏯', matches: (c) => c.region === 'Asia', capIslands: true },
  { id: 'americas', label: 'Americas', emoji: '🌎', matches: (c) => c.region === 'Americas', capIslands: true },
  { id: 'oceania', label: 'Oceania', emoji: '🌏', matches: (c) => c.region === 'Oceania', capIslands: false },
  { id: 'islands', label: 'Islands', emoji: '🏝️', matches: (c) => c.isIsland, capIslands: false },
];

export function getRegion(id: RegionId): RegionConfig {
  return REGIONS.find((r) => r.id === id)!;
}

export function getRegionCountries(id: RegionId): Country[] {
  return countries.filter(getRegion(id).matches);
}

/**
 * regional-full: the daily's country → capital → flag round, on a region's countries.
 * regional-quiz: only the "guess the country on the map" step, on a region's countries.
 * time: country-on-the-map rounds across the whole world, scored by total time.
 * flag: a flag is shown and the player types the country.
 */
export type ChallengeKind = 'regional-full' | 'regional-quiz' | 'time' | 'flag';

export interface ChallengeSetup {
  kind: ChallengeKind;
  /** Required for the two regional kinds. */
  region?: RegionId;
}

export const CHALLENGE_ROUNDS: Record<ChallengeKind, number> = {
  'regional-full': 7,
  'regional-quiz': 10,
  time: 10,
  flag: 10,
};

/** Seconds added to the final time for each wrong guess in the Time Challenge. */
export const TIME_PENALTY_SECONDS = 10;

export function challengeTitle({ kind, region }: ChallengeSetup): string {
  switch (kind) {
    case 'regional-full':
      return `${getRegion(region!).label} · Full Round`;
    case 'regional-quiz':
      return `${getRegion(region!).label} · Country Quiz`;
    case 'time':
      return 'Time Challenge';
    case 'flag':
      return 'Flag Challenge';
  }
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Picks the countries for one game — random each call, unlike the date-seeded daily. */
export function buildChallengeCountries(setup: ChallengeSetup, rng: () => number = Math.random): Country[] {
  const count = CHALLENGE_ROUNDS[setup.kind];
  const region = setup.region ? getRegion(setup.region) : null;
  const pool = shuffle(region ? getRegionCountries(region.id) : countries, rng);
  // The flag challenge doesn't depend on placing a country on a map, so islands are no harder there.
  const capIslands = setup.kind === 'flag' ? false : (region?.capIslands ?? true);
  return capIslands ? selectWithIslandCaps(pool, count) : pool.slice(0, count);
}

/** How many wrong guesses a country round cost, given the medal it ended on (a skip counts as all three tries). */
export function wrongGuessesForTier(tier: StarTier): number {
  if (tier === 'gold') return 0;
  if (tier === 'silver') return 1;
  if (tier === 'bronze') return 2;
  return 3;
}

/** Formats seconds as m:ss.t, e.g. 83.4 -> "1:23.4". */
export function formatChallengeTime(seconds: number): string {
  const tenths = Math.round(Math.max(0, seconds) * 10);
  const minutes = Math.floor(tenths / 600);
  const secs = (tenths % 600) / 10;
  return `${minutes}:${secs.toFixed(1).padStart(4, '0')}`;
}
