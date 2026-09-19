/**
 * Achievement engine. Pure logic: given a finished game (and the player's saved
 * profile) it works out which achievements the game earned and the updated profile.
 * Persistence lives in achievementStore.ts; UI is not part of this file.
 *
 * Every threshold is an exported constant and every definition carries a plain-language
 * description, because the "How scoring works" screen renders straight from ACHIEVEMENTS.
 */
import { countries } from '../data/countries';
import { CHALLENGE_ROUNDS, formatChallengeTime, REGIONS, type ChallengeKind, type RegionId } from './challenges';
import type { StarTier } from './points';

export type GameKind = 'daily' | ChallengeKind;

export interface RoundSummary {
  countryId: string;
  isIsland: boolean;
  /**
   * Medal per category. `undefined` means the game never asked that category (a country
   * quiz has no capital or flag step); `null` means it was asked and missed.
   */
  tiers: { country: StarTier; capital?: StarTier; flag?: StarTier };
  stars: number;
  points: number;
  skipped: boolean;
}

export interface GameSummary {
  kind: GameKind;
  /** Set for the two regional kinds. */
  region?: RegionId;
  rounds: RoundSummary[];
  /** Time Challenge only: final time in seconds, penalties included. */
  timeSeconds?: number;
  /** Time Challenge only: the penalty part of timeSeconds. */
  penaltySeconds?: number;
}

/** Long-lived progress the history-based achievements are measured against. */
export interface AchievementProfile {
  dailyGames: number;
  lifetimeStars: number;
  bestStreak: number;
  countriesFound: string[];
  fullRoundRegions: RegionId[];
  /** Best result per board (see bestKey): points, or seconds for the Time Challenge. */
  bests: Record<string, number>;
  /** Highest level ever earned for each achievement id. */
  earned: Record<string, number>;
}

export function createEmptyProfile(): AchievementProfile {
  return {
    dailyGames: 0,
    lifetimeStars: 0,
    bestStreak: 0,
    countriesFound: [],
    fullRoundRegions: [],
    bests: {},
    earned: {},
  };
}

// --- Thresholds --------------------------------------------------------------------

/** Gold Standard: at least this percentage of the game's medals must be gold. */
export const GOLD_STANDARD_PERCENT = 80;
/** Gold Standard needs at least this many medals in the game, so a tiny game can't qualify by luck. */
export const GOLD_STANDARD_MIN_MEDALS = 7;
/** Big Score: total points in a daily or regional full round. A day's maximum is 8,400. */
export const BIG_SCORE_LEVELS = [5000, 6000, 7000, 8000];
/** Speed Demon: Time Challenge final time (penalties included), in seconds. */
export const SPEED_DEMON_SECONDS = [120, 90, 60];
/** Slow and Steady: skips in a single Time Challenge. */
export const SLOW_AND_STEADY_SKIPS = 5;
/** Flag Reader: flags identified (on any try) out of the Flag Challenge's ten. */
export const FLAG_READER_LEVELS = [8, 10];
/** Bronze Bounty: bronze country medals in one game. */
export const BRONZE_BOUNTY_MEDALS = 3;
/** Island Hopper: island countries a game must contain for the achievement to count. */
export const ISLAND_HOPPER_MIN_ISLANDS = 2;
export const STREAK_LEVELS = [3, 7, 14, 30, 100];
export const REGULAR_LEVELS = [10, 50, 100];
export const STAR_COLLECTOR_LEVELS = [100, 500, 1000];
export const WHOLE_WORLD_LEVELS = [50, 100, 150, countries.length];

// --- Definitions -------------------------------------------------------------------

export interface AchievementLevel {
  threshold: number;
  label: string;
}

interface EvalContext {
  game: GameSummary;
  before: AchievementProfile;
  after: AchievementProfile;
}

export interface AchievementDef {
  id: string;
  emoji: string;
  name: string;
  /** Plain-language rule, shown in the scoring guide. */
  description: string;
  /**
   * 'game' achievements are reported every game that earns them; 'lifetime' ones are
   * reported only when they're first earned or reach a new level.
   */
  scope: 'game' | 'lifetime';
  /** For tiered achievements, the thresholds in ascending order of difficulty. */
  levels?: AchievementLevel[];
  /** Level reached (1-based), or 0 when not earned / not applicable to this game. */
  evaluate: (ctx: EvalContext) => number;
  /** Extra line shown next to the achievement when earned. */
  detail?: (ctx: EvalContext) => string | undefined;
}

const levelsFor = (thresholds: number[], label: (t: number) => string): AchievementLevel[] =>
  thresholds.map((threshold) => ({ threshold, label: label(threshold) }));

/** Number of thresholds `value` has reached (higher is better). */
function levelAtLeast(value: number, thresholds: number[]): number {
  return thresholds.filter((t) => value >= t).length;
}

/** Number of thresholds `value` has beaten (lower is better, e.g. a time). */
function levelAtMost(value: number, thresholds: number[]): number {
  return thresholds.filter((t) => value <= t).length;
}

const isFullRound = (game: GameSummary) => game.kind === 'daily' || game.kind === 'regional-full';
const totalPoints = (game: GameSummary) => game.rounds.reduce((sum, r) => sum + r.points, 0);
const totalStars = (game: GameSummary) => game.rounds.reduce((sum, r) => sum + r.stars, 0);
const countryTiers = (game: GameSummary) => game.rounds.map((r) => r.tiers.country);

/** Every medal slot the game asked about, in order. */
function allTiers(game: GameSummary): StarTier[] {
  return game.rounds.flatMap((r) => [
    r.tiers.country,
    ...(r.tiers.capital !== undefined ? [r.tiers.capital] : []),
    ...(r.tiers.flag !== undefined ? [r.tiers.flag] : []),
  ]);
}

const pass = (condition: boolean): number => (condition ? 1 : 0);

/** Which personal-best board a game belongs to. */
export function bestKey(game: GameSummary): string {
  switch (game.kind) {
    case 'daily':
    case 'time':
    case 'flag':
      return game.kind;
    case 'regional-full':
    case 'regional-quiz':
      return `${game.kind}:${game.region}`;
  }
}

/** The number a personal best is measured in: seconds for the Time Challenge (lower wins), points otherwise. */
function bestValue(game: GameSummary): number {
  return game.kind === 'time' ? (game.timeSeconds ?? Number.NaN) : totalPoints(game);
}

function beats(kind: GameKind, value: number, previous: number): boolean {
  return kind === 'time' ? value < previous : value > previous;
}

const REGIONAL_MASTERS: AchievementDef[] = REGIONS.map((region) => ({
  id: `regional-master-${region.id}`,
  emoji: region.emoji,
  name: `Regional Master: ${region.label}`,
  description: `Find all ${CHALLENGE_ROUNDS['regional-quiz']} countries in a Country Quiz on ${region.label} (any try counts).`,
  scope: 'game',
  evaluate: ({ game }) =>
    pass(
      game.kind === 'regional-quiz' &&
        game.region === region.id &&
        game.rounds.length === CHALLENGE_ROUNDS['regional-quiz'] &&
        countryTiers(game).every((t) => t !== null),
    ),
}));

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- Any game ---
  {
    id: 'gold-standard',
    emoji: '🥇',
    name: 'Gold Standard',
    description: `At least ${GOLD_STANDARD_PERCENT}% of the medals in a game are gold (correct on the first try). Needs ${GOLD_STANDARD_MIN_MEDALS}+ medals in the game.`,
    scope: 'game',
    evaluate: ({ game }) => {
      const tiers = allTiers(game);
      const gold = tiers.filter((t) => t === 'gold').length;
      return pass(tiers.length >= GOLD_STANDARD_MIN_MEDALS && gold * 100 >= GOLD_STANDARD_PERCENT * tiers.length);
    },
  },
  {
    id: 'first-try',
    emoji: '⚡',
    name: 'First Try',
    description: 'Every country in the game is correct on the first try.',
    scope: 'game',
    evaluate: ({ game }) => pass(game.rounds.length > 0 && countryTiers(game).every((t) => t === 'gold')),
  },
  {
    id: 'cartographer',
    emoji: '🧭',
    name: 'Cartographer',
    description: 'Every country in the game is found, on any try.',
    scope: 'game',
    evaluate: ({ game }) => pass(game.rounds.length > 0 && countryTiers(game).every((t) => t !== null)),
  },
  {
    id: 'bronze-bounty',
    emoji: '🍀',
    name: 'Bronze Bounty',
    description: `${BRONZE_BOUNTY_MEDALS}+ countries found on the third try, and no country missed.`,
    scope: 'game',
    evaluate: ({ game }) => {
      const tiers = countryTiers(game);
      return pass(tiers.every((t) => t !== null) && tiers.filter((t) => t === 'bronze').length >= BRONZE_BOUNTY_MEDALS);
    },
  },
  {
    id: 'island-hopper',
    emoji: '🏝️',
    name: 'Island Hopper',
    description: `Find every island nation in a game that has at least ${ISLAND_HOPPER_MIN_ISLANDS} of them.`,
    scope: 'game',
    evaluate: ({ game }) => {
      const islands = game.rounds.filter((r) => r.isIsland);
      return pass(islands.length >= ISLAND_HOPPER_MIN_ISLANDS && islands.every((r) => r.tiers.country !== null));
    },
  },
  {
    id: 'personal-best',
    emoji: '📈',
    name: 'Personal Best',
    description:
      'Beat your previous best for that game type: points for the daily, regional and flag games, or time for the Time Challenge. Your first game of a type sets the mark and does not count.',
    scope: 'game',
    evaluate: ({ game, before, after }) => {
      const key = bestKey(game);
      return pass(before.bests[key] !== undefined && after.bests[key] !== before.bests[key]);
    },
    detail: ({ game }) =>
      game.kind === 'time'
        ? `New best time: ${formatChallengeTime(game.timeSeconds ?? 0)}`
        : `New best: ${totalPoints(game).toLocaleString()} pts`,
  },

  // --- Daily and regional Full Round ---
  {
    id: 'perfect-round',
    emoji: '🎯',
    name: 'Perfect Round',
    description: 'Earn all 3 stars in a single round (country, capital and flag all correct).',
    scope: 'game',
    evaluate: ({ game }) => pass(isFullRound(game) && game.rounds.some((r) => r.stars === 3)),
  },
  {
    id: 'flawless-day',
    emoji: '💎',
    name: 'Flawless',
    description: 'Earn 3 stars in every round of a daily or regional Full Round.',
    scope: 'game',
    evaluate: ({ game }) => pass(isFullRound(game) && game.rounds.length > 0 && game.rounds.every((r) => r.stars === 3)),
  },
  {
    id: 'big-score',
    emoji: '💰',
    name: 'Big Score',
    description: 'Score a four-figure total in a daily or regional Full Round, starting at 5,000 points. A perfect day is 8,400.',
    scope: 'game',
    levels: levelsFor(BIG_SCORE_LEVELS, (t) => `${t / 1000}K`),
    evaluate: ({ game }) => (isFullRound(game) ? levelAtLeast(totalPoints(game), BIG_SCORE_LEVELS) : 0),
  },
  {
    id: 'capital-connoisseur',
    emoji: '🏛️',
    name: 'Capital Connoisseur',
    description: 'Get every capital right in a daily or regional Full Round.',
    scope: 'game',
    evaluate: ({ game }) =>
      pass(isFullRound(game) && game.rounds.length > 0 && game.rounds.every((r) => r.tiers.capital != null)),
  },
  {
    id: 'flag-fanatic',
    emoji: '🚩',
    name: 'Flag Fanatic',
    description: 'Get every flag right in a daily or regional Full Round.',
    scope: 'game',
    evaluate: ({ game }) =>
      pass(isFullRound(game) && game.rounds.length > 0 && game.rounds.every((r) => r.tiers.flag != null)),
  },
  {
    id: 'comeback-kid',
    emoji: '🩹',
    name: 'Comeback Kid',
    description: 'Earn 3 stars in a round after having 2 or more rounds with no stars earlier in the same game.',
    scope: 'game',
    evaluate: ({ game }) => {
      if (!isFullRound(game)) return 0;
      let starless = 0;
      for (const round of game.rounds) {
        if (round.stars === 3 && starless >= 2) return 1;
        if (round.stars === 0) starless++;
      }
      return 0;
    },
  },

  // --- Time Challenge ---
  {
    id: 'speed-demon',
    emoji: '⏱️',
    name: 'Speed Demon',
    description: 'Finish the Time Challenge quickly. Penalty seconds count towards your time.',
    scope: 'game',
    levels: levelsFor(SPEED_DEMON_SECONDS, (t) => `Under ${formatChallengeTime(t).replace(/\.0$/, '')}`),
    evaluate: ({ game }) =>
      game.kind === 'time' && game.timeSeconds !== undefined ? levelAtMost(game.timeSeconds, SPEED_DEMON_SECONDS) : 0,
  },
  {
    id: 'ice-cold',
    emoji: '🧊',
    name: 'Ice Cold',
    description: 'Finish a Time Challenge with no penalty seconds at all.',
    scope: 'game',
    evaluate: ({ game }) => pass(game.kind === 'time' && game.rounds.length > 0 && game.penaltySeconds === 0),
  },
  {
    id: 'slow-and-steady',
    emoji: '🐢',
    name: 'Slow and Steady',
    description: `Finish a Time Challenge even after skipping ${SLOW_AND_STEADY_SKIPS} or more countries.`,
    scope: 'game',
    evaluate: ({ game }) =>
      pass(game.kind === 'time' && game.rounds.filter((r) => r.skipped).length >= SLOW_AND_STEADY_SKIPS),
  },

  // --- Flag Challenge ---
  {
    id: 'flag-reader',
    emoji: '👁️',
    name: 'Flag Reader',
    description: 'Identify most of the flags in a Flag Challenge (any try counts).',
    scope: 'game',
    levels: levelsFor(FLAG_READER_LEVELS, (t) => `${t} of ${CHALLENGE_ROUNDS.flag}`),
    evaluate: ({ game }) =>
      game.kind === 'flag'
        ? levelAtLeast(countryTiers(game).filter((t) => t !== null).length, FLAG_READER_LEVELS)
        : 0,
  },
  {
    id: 'vexillologist',
    emoji: '🏳️',
    name: 'Vexillologist',
    description: `Identify all ${CHALLENGE_ROUNDS.flag} flags in a Flag Challenge on the first try.`,
    scope: 'game',
    evaluate: ({ game }) =>
      pass(
        game.kind === 'flag' &&
          game.rounds.length === CHALLENGE_ROUNDS.flag &&
          countryTiers(game).every((t) => t === 'gold'),
      ),
  },

  // --- Regional Country Quiz ---
  ...REGIONAL_MASTERS,

  // --- Over time (need saved history) ---
  {
    id: 'on-fire',
    emoji: '🔥',
    name: 'On Fire',
    description: 'Play the daily challenge on consecutive days. Your best streak counts.',
    scope: 'lifetime',
    levels: levelsFor(STREAK_LEVELS, (t) => `${t} days`),
    evaluate: ({ after }) => levelAtLeast(after.bestStreak, STREAK_LEVELS),
  },
  {
    id: 'regular',
    emoji: '📅',
    name: 'Regular',
    description: 'Complete the daily challenge on different days.',
    scope: 'lifetime',
    levels: levelsFor(REGULAR_LEVELS, (t) => `${t} days`),
    evaluate: ({ after }) => levelAtLeast(after.dailyGames, REGULAR_LEVELS),
  },
  {
    id: 'star-collector',
    emoji: '⭐',
    name: 'Star Collector',
    description: 'Earn stars across every game you play.',
    scope: 'lifetime',
    levels: levelsFor(STAR_COLLECTOR_LEVELS, (t) => `${t.toLocaleString()} stars`),
    evaluate: ({ after }) => levelAtLeast(after.lifetimeStars, STAR_COLLECTOR_LEVELS),
  },
  {
    id: 'globetrotter',
    emoji: '🧳',
    name: 'Globetrotter',
    description: `Complete a Full Round in each of the ${REGIONS.length} regions.`,
    scope: 'lifetime',
    evaluate: ({ after }) => pass(REGIONS.every((r) => after.fullRoundRegions.includes(r.id))),
  },
  {
    id: 'whole-world',
    emoji: '🗺️',
    name: 'Whole World',
    description: 'Build up the number of different countries you have found, across every game. Each country counts once, however often you find it.',
    scope: 'lifetime',
    levels: levelsFor(WHOLE_WORLD_LEVELS, (t) => (t >= countries.length ? 'Every country' : `${t} countries`)),
    evaluate: ({ after }) => levelAtLeast(after.countriesFound.length, WHOLE_WORLD_LEVELS),
  },
];

// --- Evaluation --------------------------------------------------------------------

export interface EarnedAchievement {
  id: string;
  emoji: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  /** Label of the level reached, for tiered achievements (e.g. "6K"). */
  levelLabel?: string;
  /** True the first time this achievement, or a higher level of it, is earned. */
  isNew: boolean;
  detail?: string;
}

export interface EvaluationResult {
  earned: EarnedAchievement[];
  /** The profile with this game folded in — save this. */
  profile: AchievementProfile;
}

/** Folds a finished game into the profile's counters and bests (does not touch `earned`). */
export function applyGameToProfile(
  profile: AchievementProfile,
  game: GameSummary,
  dailyStreak = 0,
): AchievementProfile {
  const found = new Set(profile.countriesFound);
  for (const round of game.rounds) {
    if (round.tiers.country) found.add(round.countryId);
  }

  const key = bestKey(game);
  const value = bestValue(game);
  const previous = profile.bests[key];
  const setsBest = Number.isFinite(value) && (previous === undefined || beats(game.kind, value, previous));

  return {
    ...profile,
    dailyGames: profile.dailyGames + (game.kind === 'daily' ? 1 : 0),
    lifetimeStars: profile.lifetimeStars + totalStars(game),
    bestStreak: Math.max(profile.bestStreak, dailyStreak),
    countriesFound: [...found],
    fullRoundRegions:
      game.kind === 'regional-full' && game.region && !profile.fullRoundRegions.includes(game.region)
        ? [...profile.fullRoundRegions, game.region]
        : profile.fullRoundRegions,
    bests: setsBest ? { ...profile.bests, [key]: value } : profile.bests,
  };
}

/**
 * Works out what a finished game earned. Call exactly once per game — folding the same
 * game into the profile twice would double-count it.
 *
 * @param dailyStreak the player's current daily streak, for daily games
 */
export function evaluateGame(
  game: GameSummary,
  previous: AchievementProfile,
  dailyStreak = 0,
): EvaluationResult {
  const after = applyGameToProfile(previous, game, dailyStreak);
  const ctx: EvalContext = { game, before: previous, after };
  const earned: EarnedAchievement[] = [];
  const earnedLevels = { ...previous.earned };

  for (const def of ACHIEVEMENTS) {
    const level = def.evaluate(ctx);
    if (level <= 0) continue;

    const isNew = level > (previous.earned[def.id] ?? 0);
    // Lifetime achievements are only news when they're new; repeating "Regular" after every game would be noise.
    if (def.scope === 'lifetime' && !isNew) continue;
    if (isNew) earnedLevels[def.id] = level;

    earned.push({
      id: def.id,
      emoji: def.emoji,
      name: def.name,
      description: def.description,
      level,
      maxLevel: def.levels?.length ?? 1,
      levelLabel: def.levels?.[level - 1]?.label,
      isNew,
      detail: def.detail?.(ctx),
    });
  }

  return { earned, profile: { ...after, earned: earnedLevels } };
}
