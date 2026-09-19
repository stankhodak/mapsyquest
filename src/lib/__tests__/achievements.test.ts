import { beforeEach, describe, expect, it } from 'vitest';
import { countries } from '../../data/countries';
import {
  ACHIEVEMENTS,
  applyGameToProfile,
  createEmptyProfile,
  evaluateGame,
  type AchievementProfile,
  type GameSummary,
  type RoundSummary,
} from '../achievements';
import { loadAchievementProfile, recordGame } from '../achievementStore';
import { REGIONS, type RegionId } from '../challenges';
import type { StarTier } from '../points';

let nextCountry = 0;

/** One country-only round (quiz / time / flag games). */
function quizRound(tier: StarTier, opts: Partial<RoundSummary> = {}): RoundSummary {
  const points = tier === 'gold' ? 100 : tier === 'silver' ? 70 : tier === 'bronze' ? 40 : 0;
  return {
    countryId: countries[nextCountry++ % countries.length].id,
    isIsland: false,
    tiers: { country: tier },
    stars: tier ? 1 : 0,
    points,
    skipped: false,
    ...opts,
  };
}

/** One full round with all three categories. */
function fullRound(tiers: { country: StarTier; capital: StarTier; flag: StarTier }, points = 600): RoundSummary {
  const stars = [tiers.country, tiers.capital, tiers.flag].filter((t) => t !== null).length;
  return {
    countryId: countries[nextCountry++ % countries.length].id,
    isIsland: false,
    tiers,
    stars,
    points,
    skipped: false,
  };
}

const PERFECT = { country: 'gold', capital: 'gold', flag: 'gold' } as const;

function game(kind: GameSummary['kind'], rounds: RoundSummary[], extra: Partial<GameSummary> = {}): GameSummary {
  return { kind, rounds, ...extra };
}

function earnedIds(g: GameSummary, profile: AchievementProfile = createEmptyProfile(), streak = 0): string[] {
  return evaluateGame(g, profile, streak).earned.map((e) => e.id);
}

/** Runs a game and returns just the earned entry for one achievement. */
function earnedEntry(id: string, g: GameSummary, profile = createEmptyProfile(), streak = 0) {
  return evaluateGame(g, profile, streak).earned.find((e) => e.id === id);
}

describe('achievement definitions', () => {
  it('have unique ids and a plain-language description', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ACHIEVEMENTS.every((a) => a.description.length > 10)).toBe(true);
  });

  it('include one Regional Master per region', () => {
    for (const region of REGIONS) {
      expect(ACHIEVEMENTS.some((a) => a.id === `regional-master-${region.id}`)).toBe(true);
    }
  });
});

describe('Gold Standard (80% gold)', () => {
  /** 7 full rounds = 21 medals; `nonGold` of them are downgraded to silver, the rest are gold. */
  function dailyWithNonGold(nonGold: number): GameSummary {
    const slots: StarTier[] = Array.from({ length: 21 }, (_, i) => (i < nonGold ? 'silver' : 'gold'));
    const rounds = Array.from({ length: 7 }, (_, i) =>
      fullRound({ country: slots[i * 3], capital: slots[i * 3 + 1], flag: slots[i * 3 + 2] }),
    );
    return game('daily', rounds);
  }

  it('is earned with 17 of 21 medals gold (81%)', () => {
    expect(earnedIds(dailyWithNonGold(4))).toContain('gold-standard');
  });

  it('is not earned with 16 of 21 medals gold (76%)', () => {
    expect(earnedIds(dailyWithNonGold(5))).not.toContain('gold-standard');
  });

  it('is earned at exactly 80% (8 of 10 in a quiz)', () => {
    const tiers: StarTier[] = ['gold', 'gold', 'gold', 'gold', 'gold', 'gold', 'gold', 'gold', 'silver', 'bronze'];
    expect(earnedIds(game('regional-quiz', tiers.map((t) => quizRound(t)), { region: 'europe' }))).toContain(
      'gold-standard',
    );
  });

  it('is not earned at 70% (7 of 10 in a quiz)', () => {
    const tiers: StarTier[] = ['gold', 'gold', 'gold', 'gold', 'gold', 'gold', 'gold', 'silver', 'silver', 'silver'];
    expect(earnedIds(game('regional-quiz', tiers.map((t) => quizRound(t)), { region: 'europe' }))).not.toContain(
      'gold-standard',
    );
  });

  it('needs at least 7 medals in the game', () => {
    const rounds = Array.from({ length: 6 }, () => quizRound('gold'));
    expect(earnedIds(game('flag', rounds))).not.toContain('gold-standard');
  });

  it('counts a skipped or missed medal against you', () => {
    const rounds = [...Array.from({ length: 7 }, () => quizRound('gold')), quizRound(null), quizRound(null), quizRound(null)];
    expect(earnedIds(game('flag', rounds))).not.toContain('gold-standard');
  });
});

describe('Big Score (starts at 5,000)', () => {
  function dailyScoring(total: number): GameSummary {
    // Spread the total over 7 rounds; only the sum matters to the achievement.
    const each = Math.floor(total / 7);
    const rounds = Array.from({ length: 7 }, (_, i) =>
      fullRound(PERFECT, i === 6 ? total - each * 6 : each),
    );
    return game('daily', rounds);
  }

  it('is not earned below 5,000', () => {
    expect(earnedIds(dailyScoring(4999))).not.toContain('big-score');
  });

  it.each([
    [5000, 1, '5K'],
    [5999, 1, '5K'],
    [6000, 2, '6K'],
    [7400, 3, '7K'],
    [8400, 4, '8K'],
  ])('%i points reaches level %i (%s)', (total, level, label) => {
    const entry = earnedEntry('big-score', dailyScoring(total));
    expect(entry?.level).toBe(level);
    expect(entry?.levelLabel).toBe(label);
    expect(entry?.maxLevel).toBe(4);
  });

  it('also counts in a regional Full Round', () => {
    expect(earnedIds(game('regional-full', dailyScoring(5200).rounds, { region: 'asia' }))).toContain('big-score');
  });

  it('does not apply to quizzes, which cannot reach a four-figure score', () => {
    const rounds = Array.from({ length: 10 }, () => quizRound('gold', { points: 900 }));
    expect(earnedIds(game('regional-quiz', rounds, { region: 'asia' }))).not.toContain('big-score');
  });
});

describe('country-based achievements', () => {
  it('First Try needs every country on the first try', () => {
    const allGold = Array.from({ length: 10 }, () => quizRound('gold'));
    expect(earnedIds(game('time', allGold, { timeSeconds: 200, penaltySeconds: 0 }))).toContain('first-try');
    const oneSilver = [...allGold.slice(1), quizRound('silver')];
    expect(earnedIds(game('time', oneSilver, { timeSeconds: 200, penaltySeconds: 10 }))).not.toContain('first-try');
  });

  it('Cartographer allows later tries but not a miss', () => {
    const found = [quizRound('gold'), quizRound('silver'), quizRound('bronze')];
    expect(earnedIds(game('flag', found))).toContain('cartographer');
    expect(earnedIds(game('flag', [...found, quizRound(null)]))).not.toContain('cartographer');
  });

  it('Bronze Bounty needs 3+ bronze finds and no misses', () => {
    const three = [quizRound('bronze'), quizRound('bronze'), quizRound('bronze'), quizRound('gold')];
    expect(earnedIds(game('flag', three))).toContain('bronze-bounty');
    expect(earnedIds(game('flag', [...three, quizRound(null)]))).not.toContain('bronze-bounty');
    expect(earnedIds(game('flag', [quizRound('bronze'), quizRound('bronze'), quizRound('gold')]))).not.toContain(
      'bronze-bounty',
    );
  });

  it('Island Hopper needs 2+ islands, all found', () => {
    const island = (tier: StarTier) => quizRound(tier, { isIsland: true });
    expect(earnedIds(game('time', [island('gold'), island('bronze'), quizRound(null)]))).toContain('island-hopper');
    expect(earnedIds(game('time', [island('gold'), quizRound('gold')]))).not.toContain('island-hopper');
    expect(earnedIds(game('time', [island('gold'), island(null)]))).not.toContain('island-hopper');
  });
});

describe('Full Round achievements', () => {
  const miss = { country: null, capital: null, flag: null } as const;

  it('Perfect Round needs one 3-star round', () => {
    expect(earnedIds(game('daily', [fullRound(miss), fullRound(PERFECT)]))).toContain('perfect-round');
    expect(
      earnedIds(game('daily', [fullRound({ country: 'gold', capital: 'gold', flag: null })])),
    ).not.toContain('perfect-round');
  });

  it('Flawless needs 3 stars in every round', () => {
    expect(earnedIds(game('daily', Array.from({ length: 7 }, () => fullRound(PERFECT))))).toContain('flawless-day');
    expect(earnedIds(game('daily', [fullRound(PERFECT), fullRound(miss)]))).not.toContain('flawless-day');
  });

  it('Capital Connoisseur and Flag Fanatic check their own category', () => {
    const capitalsOnly = [fullRound({ country: null, capital: 'gold', flag: null })];
    expect(earnedIds(game('daily', capitalsOnly))).toContain('capital-connoisseur');
    expect(earnedIds(game('daily', capitalsOnly))).not.toContain('flag-fanatic');
  });

  it('do not fire for games without those categories', () => {
    const quiz = game('regional-quiz', [quizRound('gold')], { region: 'europe' });
    expect(earnedIds(quiz)).not.toContain('perfect-round');
    expect(earnedIds(quiz)).not.toContain('capital-connoisseur');
  });

  it.each([
    [[0, 0, 3], true],
    [[0, 3, 3], false],
    [[0, 3, 3, 0, 3], true],
    [[3, 0, 0], false],
    [[0, 0, 2], false],
  ])('Comeback Kid for star sequence %j is %s', (stars, expected) => {
    const rounds = stars.map((s) =>
      fullRound(
        s === 3
          ? PERFECT
          : s === 2
            ? { country: 'gold', capital: 'gold', flag: null }
            : miss,
      ),
    );
    expect(earnedIds(game('daily', rounds)).includes('comeback-kid')).toBe(expected);
  });
});

describe('Time Challenge achievements', () => {
  const rounds = () => Array.from({ length: 10 }, () => quizRound('gold'));
  const timed = (timeSeconds: number, penaltySeconds = 0, r = rounds()) =>
    game('time', r, { timeSeconds, penaltySeconds });

  it.each([
    [130, 0, undefined],
    [119.9, 1, 'Under 2:00'],
    [89, 2, 'Under 1:30'],
    [59.9, 3, 'Under 1:00'],
  ])('Speed Demon at %f seconds is level %i', (seconds, level, label) => {
    const entry = earnedEntry('speed-demon', timed(seconds));
    expect(entry?.level ?? 0).toBe(level);
    expect(entry?.levelLabel).toBe(label);
  });

  it('Ice Cold requires zero penalty seconds', () => {
    expect(earnedIds(timed(100, 0))).toContain('ice-cold');
    expect(earnedIds(timed(100, 10))).not.toContain('ice-cold');
  });

  it('Slow and Steady needs 5+ skips', () => {
    const withSkips = (n: number) =>
      Array.from({ length: 10 }, (_, i) => (i < n ? quizRound(null, { skipped: true }) : quizRound('gold')));
    expect(earnedIds(timed(400, 150, withSkips(5)))).toContain('slow-and-steady');
    expect(earnedIds(timed(400, 120, withSkips(4)))).not.toContain('slow-and-steady');
  });

  it('do not fire outside the Time Challenge', () => {
    const ids = earnedIds(game('flag', rounds(), { timeSeconds: 30, penaltySeconds: 0 }));
    expect(ids).not.toContain('speed-demon');
    expect(ids).not.toContain('ice-cold');
  });
});

describe('Flag Challenge achievements', () => {
  const flags = (tiers: StarTier[]) => game('flag', tiers.map((t) => quizRound(t)));

  it('Flag Reader has two levels', () => {
    expect(earnedEntry('flag-reader', flags(Array(7).fill('gold').concat(Array(3).fill(null))))).toBeUndefined();
    const eight = flags([...Array(6).fill('gold'), 'silver', 'bronze', null, null]);
    expect(earnedEntry('flag-reader', eight)?.level).toBe(1);
    const ten = flags([...Array(9).fill('gold'), 'bronze']);
    expect(earnedEntry('flag-reader', ten)?.level).toBe(2);
    expect(earnedEntry('flag-reader', ten)?.levelLabel).toBe('10 of 10');
  });

  it('Vexillologist needs all ten on the first try', () => {
    expect(earnedIds(flags(Array(10).fill('gold')))).toContain('vexillologist');
    expect(earnedIds(flags([...Array(9).fill('gold'), 'silver']))).not.toContain('vexillologist');
  });
});

describe('Regional Master', () => {
  const quiz = (region: RegionId, tiers: StarTier[]) =>
    game('regional-quiz', tiers.map((t) => quizRound(t)), { region });

  it('is earned for the region played, and only that region', () => {
    const ids = earnedIds(quiz('oceania', Array(10).fill('silver')));
    expect(ids).toContain('regional-master-oceania');
    expect(ids).not.toContain('regional-master-europe');
  });

  it('needs all 10 found', () => {
    expect(earnedIds(quiz('asia', [...Array(9).fill('gold'), null]))).not.toContain('regional-master-asia');
  });

  it('is not earned by a Full Round', () => {
    const full = game('regional-full', Array.from({ length: 7 }, () => fullRound(PERFECT)), { region: 'asia' });
    expect(earnedIds(full)).not.toContain('regional-master-asia');
  });
});

describe('profile and history-based achievements', () => {
  it('folds a game into the profile without mutating the previous one', () => {
    const before = createEmptyProfile();
    const g = game('daily', [fullRound(PERFECT), fullRound({ country: 'gold', capital: null, flag: null })]);
    const after = applyGameToProfile(before, g, 2);
    expect(before).toEqual(createEmptyProfile());
    expect(after.dailyGames).toBe(1);
    expect(after.lifetimeStars).toBe(4);
    expect(after.bestStreak).toBe(2);
    expect(after.countriesFound).toHaveLength(2);
  });

  it('only counts countries actually found, and only once', () => {
    const found = quizRound('gold');
    const missed = quizRound(null);
    const once = applyGameToProfile(createEmptyProfile(), game('flag', [found, missed]));
    expect(once.countriesFound).toEqual([found.countryId]);
    const twice = applyGameToProfile(once, game('flag', [found]));
    expect(twice.countriesFound).toEqual([found.countryId]);
  });

  it('On Fire reports each streak level only once', () => {
    const g = game('daily', [fullRound(PERFECT)]);
    const first = evaluateGame(g, createEmptyProfile(), 3);
    expect(first.earned.find((e) => e.id === 'on-fire')).toMatchObject({ level: 1, levelLabel: '3 days', isNew: true });

    const sameLevel = evaluateGame(g, first.profile, 4);
    expect(sameLevel.earned.find((e) => e.id === 'on-fire')).toBeUndefined();

    const levelUp = evaluateGame(g, sameLevel.profile, 7);
    expect(levelUp.earned.find((e) => e.id === 'on-fire')).toMatchObject({ level: 2, levelLabel: '7 days' });
  });

  it('a broken streak never lowers the best streak', () => {
    const g = game('daily', [fullRound(PERFECT)]);
    const p = evaluateGame(g, createEmptyProfile(), 7).profile;
    expect(evaluateGame(g, p, 1).profile.bestStreak).toBe(7);
  });

  it('Regular and Star Collector count across games', () => {
    let profile = createEmptyProfile();
    const g = game('daily', [fullRound(PERFECT), fullRound(PERFECT), fullRound(PERFECT), fullRound(PERFECT)]); // 12 stars
    let regularAt: number | null = null;
    for (let i = 1; i <= 10; i++) {
      const result = evaluateGame(g, profile, 1);
      profile = result.profile;
      if (result.earned.some((e) => e.id === 'regular')) regularAt = i;
    }
    expect(regularAt).toBe(10);
    expect(profile.dailyGames).toBe(10);
    expect(profile.lifetimeStars).toBe(120);
    expect(profile.earned['star-collector']).toBe(1);
  });

  it('Globetrotter needs a Full Round in every region', () => {
    let profile = createEmptyProfile();
    const results: boolean[] = [];
    for (const region of REGIONS) {
      const g = game('regional-full', [fullRound(PERFECT)], { region: region.id });
      const result = evaluateGame(g, profile);
      profile = result.profile;
      results.push(result.earned.some((e) => e.id === 'globetrotter'));
    }
    expect(results).toEqual([false, false, false, false, true]);
  });

  it('a regional quiz does not count towards Globetrotter', () => {
    const g = game('regional-quiz', [quizRound('gold')], { region: 'europe' });
    expect(evaluateGame(g, createEmptyProfile()).profile.fullRoundRegions).toEqual([]);
  });

  it('Whole World levels up as more countries are found', () => {
    const known = countries.slice(0, 49).map((c) => c.id);
    const profile: AchievementProfile = { ...createEmptyProfile(), countriesFound: known };
    const fresh = quizRound('gold', { countryId: countries[60].id });
    const entry = earnedEntry('whole-world', game('flag', [fresh]), profile);
    expect(entry).toMatchObject({ level: 1, levelLabel: '50 countries' });
  });
});

describe('Personal Best', () => {
  const daily = (points: number) => game('daily', [fullRound(PERFECT, points)]);

  it('is not earned on the first game of a type', () => {
    expect(earnedIds(daily(3000))).not.toContain('personal-best');
  });

  it('is earned when a previous best is beaten, with the new score as detail', () => {
    const first = evaluateGame(daily(3000), createEmptyProfile());
    const second = evaluateGame(daily(3500), first.profile);
    expect(second.earned.find((e) => e.id === 'personal-best')?.detail).toBe('New best: 3,500 pts');
  });

  it('is not earned by a tie or a worse game, and keeps the old best', () => {
    const first = evaluateGame(daily(3000), createEmptyProfile());
    expect(earnedIds(daily(3000), first.profile)).not.toContain('personal-best');
    const worse = evaluateGame(daily(2000), first.profile);
    expect(worse.earned.map((e) => e.id)).not.toContain('personal-best');
    expect(worse.profile.bests.daily).toBe(3000);
  });

  it('treats a lower Time Challenge time as better', () => {
    const timed = (s: number) =>
      game('time', Array.from({ length: 10 }, () => quizRound('gold')), { timeSeconds: s, penaltySeconds: 0 });
    const first = evaluateGame(timed(100), createEmptyProfile());
    const faster = evaluateGame(timed(90.4), first.profile);
    expect(faster.earned.find((e) => e.id === 'personal-best')?.detail).toBe('New best time: 1:30.4');
    expect(earnedIds(timed(120), faster.profile)).not.toContain('personal-best');
  });

  it('keeps separate bests for each region and format', () => {
    const quiz = (region: RegionId, points: number) =>
      game('regional-quiz', [quizRound('gold', { points })], { region });
    const first = evaluateGame(quiz('europe', 500), createEmptyProfile());
    // A different region is a different board, so this is a first game there.
    expect(earnedIds(quiz('asia', 100), first.profile)).not.toContain('personal-best');
  });
});

describe('earned levels and game-scope repeats', () => {
  it('reports a game-scope achievement every time, but marks it new only once', () => {
    const g = game('daily', Array.from({ length: 7 }, () => fullRound(PERFECT)));
    const first = evaluateGame(g, createEmptyProfile());
    const second = evaluateGame(g, first.profile);
    expect(first.earned.find((e) => e.id === 'flawless-day')?.isNew).toBe(true);
    expect(second.earned.find((e) => e.id === 'flawless-day')?.isNew).toBe(false);
  });

  it('marks a higher Big Score level as new again', () => {
    const scoring = (points: number) => game('daily', [fullRound(PERFECT, points)]);
    const first = evaluateGame(scoring(5100), createEmptyProfile());
    const higher = evaluateGame(scoring(6100), first.profile);
    expect(higher.earned.find((e) => e.id === 'big-score')).toMatchObject({ level: 2, isNew: true });
    const lower = evaluateGame(scoring(5100), higher.profile);
    expect(lower.earned.find((e) => e.id === 'big-score')).toMatchObject({ level: 1, isNew: false });
    expect(lower.profile.earned['big-score']).toBe(2);
  });
});

describe('achievement store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts empty', () => {
    expect(loadAchievementProfile()).toEqual(createEmptyProfile());
  });

  it('saves the updated profile and builds on it in the next game', () => {
    const g = game('daily', [fullRound(PERFECT, 5100)]);
    recordGame(g, 3);
    const profile = loadAchievementProfile();
    expect(profile.dailyGames).toBe(1);
    expect(profile.bestStreak).toBe(3);
    expect(profile.earned['big-score']).toBe(1);
    expect(recordGame(g, 3).profile.dailyGames).toBe(2);
  });

  it('recovers from corrupt storage, and fills in fields an older save lacks', () => {
    window.localStorage.setItem('mapsyquest:achievements', '{not json');
    expect(loadAchievementProfile()).toEqual(createEmptyProfile());
    window.localStorage.setItem('mapsyquest:achievements', JSON.stringify({ dailyGames: 4 }));
    expect(loadAchievementProfile()).toEqual({ ...createEmptyProfile(), dailyGames: 4 });
  });
});
