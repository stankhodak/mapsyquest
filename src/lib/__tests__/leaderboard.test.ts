import { beforeEach, describe, expect, it, vi } from 'vitest';
import leaderboardSql from '../../../supabase/leaderboard.sql?raw';
import type { GameSummary, RoundSummary } from '../achievements';
import type { BoardEntry } from '../leaderboard';

/**
 * A tiny stand-in for the Supabase query builder: every method returns the builder, and
 * awaiting it yields whatever the test queued for that table operation. Records the calls
 * so tests can assert on what was sent.
 */
const calls: { method: string; args: unknown[] }[] = [];
let queued: Record<string, unknown>[] = [];

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit', 'lt', 'gt', 'upsert', 'update', 'maybeSingle']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => void) => resolve(queued.shift() ?? { data: null, error: null });
  return builder;
}

const updateUser = vi.fn(async () => ({ error: null }));

vi.mock('../supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: () => makeBuilder(), auth: { updateUser } },
}));

const {
  BOARDS,
  buildEntry,
  changeNickname,
  entryFromDailyRecord,
  fetchRank,
  fetchTopScores,
  formatBoardScore,
  isLowerBetter,
  MAX_DAILY_POINTS,
  MAX_QUIZ_POINTS,
  clearPendingEntry,
  loadPendingEntry,
  ranksAbove,
  saveNickname,
  savePendingEntry,
  submitScore,
  suggestedNickname,
} = await import('../leaderboard');

beforeEach(() => {
  calls.length = 0;
  queued = [];
  updateUser.mockClear();
});

function round(points: number, stars: number): RoundSummary {
  return { countryId: 'fr', isIsland: false, tiers: { country: 'gold' }, stars, points, skipped: false };
}

const dailyGame: GameSummary = { kind: 'daily', rounds: [round(1200, 3), round(600, 2)] };

describe('board rules', () => {
  it('only the time board ranks lowest first', () => {
    expect(isLowerBetter('time')).toBe(true);
    for (const board of BOARDS.filter((b) => b.id !== 'time')) expect(isLowerBetter(board.id)).toBe(false);
  });

  it('ranks scores in the right direction', () => {
    expect(ranksAbove('daily', 5000, 4000)).toBe(true);
    expect(ranksAbove('daily', 4000, 4000)).toBe(false);
    expect(ranksAbove('time', 80, 90)).toBe(true);
    expect(ranksAbove('time', 90, 90)).toBe(false);
  });

  it('formats points and times', () => {
    expect(formatBoardScore('daily', 8400)).toBe('8,400 pts');
    expect(formatBoardScore('time', 83.4)).toBe('1:23.4');
  });

  it('lists 13 boards: daily, time, flag and a Full Round and Quiz for each of the 5 regions', () => {
    expect(BOARDS).toHaveLength(13);
    expect(new Set(BOARDS.map((b) => b.id)).size).toBe(13);
  });
});

describe('buildEntry', () => {
  it('files a daily game under today, with points and stars totalled', () => {
    expect(buildEntry(dailyGame, ['big-score'], '2026-09-19')).toEqual({
      board: 'daily',
      period: '2026-09-19',
      score: 1800,
      stars: 5,
      achievementIds: ['big-score'],
    });
  });

  it("files other games under 'all', keyed by region where there is one", () => {
    const quiz: GameSummary = { kind: 'regional-quiz', region: 'asia', rounds: [round(100, 1)] };
    expect(buildEntry(quiz, [], '2026-09-19')).toMatchObject({ board: 'regional-quiz:asia', period: 'all', score: 100 });
  });

  it('posts a Time Challenge as seconds to one decimal', () => {
    const time: GameSummary = { kind: 'time', rounds: [round(0, 1)], timeSeconds: 83.4567, penaltySeconds: 10 };
    expect(buildEntry(time, [], '2026-09-19')).toMatchObject({ board: 'time', score: 83.5 });
  });

  it('has nothing to post for a Time Challenge without a time', () => {
    expect(buildEntry({ kind: 'time', rounds: [round(0, 1)] }, [], '2026-09-19')).toBeNull();
  });
});

describe('entryFromDailyRecord', () => {
  it('rebuilds the daily entry from the saved day record', () => {
    expect(entryFromDailyRecord({ date: '2026-09-19', totalPoints: 6100, totalStars: 18 }, ['big-score'])).toEqual({
      board: 'daily',
      period: '2026-09-19',
      score: 6100,
      stars: 18,
      achievementIds: ['big-score'],
    });
  });

  it('has no achievements when none are known (a returning visit)', () => {
    expect(entryFromDailyRecord({ date: '2026-09-19', totalPoints: 1, totalStars: 0 }).achievementIds).toEqual([]);
  });
});

describe('suggestedNickname', () => {
  it('prefers a saved nickname', () => {
    expect(suggestedNickname({ nickname: ' Mapsy ', full_name: 'Ada Lovelace' })).toBe('Mapsy');
  });

  it('falls back to just the first name Google shared, never the whole name or email', () => {
    expect(suggestedNickname({ full_name: 'Ada Lovelace', email: 'ada@example.com' })).toBe('Ada');
    expect(suggestedNickname({ name: 'Grace Hopper' })).toBe('Grace');
  });

  it('is empty when there is nothing usable', () => {
    expect(suggestedNickname(undefined)).toBe('');
    expect(suggestedNickname({ nickname: 42 })).toBe('');
  });
});

describe('fetchTopScores', () => {
  it('maps rows, and asks for the lowest time first on the time board', async () => {
    queued = [{ data: [{ user_id: 'u1', nickname: 'Ada', score: '83.4', stars: 10 }], error: null }];
    const result = await fetchTopScores('time', 'all');
    expect(result).toEqual({ ok: true, value: [{ userId: 'u1', nickname: 'Ada', score: 83.4, stars: 10 }] });
    expect(calls.find((c) => c.method === 'order' && c.args[0] === 'score')?.args[1]).toEqual({ ascending: true });
  });

  it('asks for the highest score first everywhere else', async () => {
    queued = [{ data: [], error: null }];
    await fetchTopScores('daily', '2026-09-19');
    expect(calls.find((c) => c.method === 'order' && c.args[0] === 'score')?.args[1]).toEqual({ ascending: false });
  });

  it('reports a database error instead of throwing', async () => {
    queued = [{ data: null, error: { message: 'relation does not exist' } }];
    expect(await fetchTopScores('daily', '2026-09-19')).toEqual({ ok: false, error: 'relation does not exist' });
  });
});

describe('fetchRank', () => {
  it('is one more than the number of strictly better scores', async () => {
    queued = [{ count: 4, error: null }];
    expect(await fetchRank('daily', '2026-09-19', 5000)).toEqual({ ok: true, value: 5 });
    expect(calls.some((c) => c.method === 'gt')).toBe(true);
  });

  it('counts lower times as better', async () => {
    queued = [{ count: 0, error: null }];
    expect(await fetchRank('time', 'all', 80)).toEqual({ ok: true, value: 1 });
    expect(calls.some((c) => c.method === 'lt')).toBe(true);
  });
});

describe('submitScore', () => {
  const entry = { board: 'daily', period: '2026-09-19', score: 5000, stars: 15, achievementIds: ['big-score'] };

  it('inserts a first score for the board and reports the rank', async () => {
    queued = [
      { data: null, error: null }, // no existing row
      { error: null }, // upsert
      { count: 2, error: null }, // two better scores
    ];
    const result = await submitScore('user-1', '  Mapsy  ', entry);
    expect(result).toEqual({ ok: true, value: { improved: true, rank: 3 } });
    const upsert = calls.find((c) => c.method === 'upsert');
    expect(upsert?.args[0]).toMatchObject({
      user_id: 'user-1',
      nickname: 'Mapsy',
      board: 'daily',
      period: '2026-09-19',
      score: 5000,
      achievements: ['big-score'],
    });
    expect(upsert?.args[1]).toEqual({ onConflict: 'user_id,board,period' });
  });

  it('replaces a worse existing score', async () => {
    queued = [{ data: { score: '4000' }, error: null }, { error: null }, { count: 0, error: null }];
    expect((await submitScore('user-1', 'Mapsy', entry)).ok).toBe(true);
    expect(calls.some((c) => c.method === 'upsert')).toBe(true);
  });

  it('keeps a better existing score and does not write', async () => {
    queued = [{ data: { score: '6000' }, error: null }, { count: 1, error: null }];
    const result = await submitScore('user-1', 'Mapsy', entry);
    expect(result).toEqual({ ok: true, value: { improved: false, rank: 2 } });
    expect(calls.some((c) => c.method === 'upsert')).toBe(false);
  });

  it('keeps an equal existing score', async () => {
    queued = [{ data: { score: '5000' }, error: null }, { count: 0, error: null }];
    const result = await submitScore('user-1', 'Mapsy', entry);
    expect(result).toEqual({ ok: true, value: { improved: false, rank: 1 } });
    expect(calls.some((c) => c.method === 'upsert')).toBe(false);
  });

  it('treats a lower time as an improvement', async () => {
    queued = [{ data: { score: '95' }, error: null }, { error: null }, { count: 0, error: null }];
    const result = await submitScore('user-1', 'Mapsy', { ...entry, board: 'time', period: 'all', score: 80 });
    expect(result).toEqual({ ok: true, value: { improved: true, rank: 1 } });
  });

  it('refuses an empty nickname before touching the database', async () => {
    const result = await submitScore('user-1', '   ', entry);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('truncates an over-long nickname to 30 characters', async () => {
    queued = [{ data: null, error: null }, { error: null }, { count: 0, error: null }];
    await submitScore('user-1', 'x'.repeat(50), entry);
    const upsert = calls.find((c) => c.method === 'upsert');
    expect(upsert).toBeDefined();
    expect((upsert!.args[0] as { nickname: string }).nickname).toHaveLength(30);
  });

  it('surfaces a write error, and still succeeds if only the rank lookup fails', async () => {
    queued = [{ data: null, error: null }, { error: { message: 'new row violates row-level security policy' } }];
    expect(await submitScore('user-1', 'Mapsy', entry)).toEqual({
      ok: false,
      error: 'new row violates row-level security policy',
    });

    queued = [{ data: null, error: null }, { error: null }, { count: null, error: { message: 'boom' } }];
    expect(await submitScore('user-1', 'Mapsy', entry)).toEqual({ ok: true, value: { improved: true, rank: null } });
  });
});

describe('saveNickname', () => {
  it('stores the trimmed nickname on the account', async () => {
    await saveNickname('  Mapsy ');
    expect(updateUser).toHaveBeenCalledWith({ data: { nickname: 'Mapsy' } });
  });
});

describe('changeNickname', () => {
  it('renames the account and every leaderboard row the player already has', async () => {
    queued = [{ error: null }];
    expect(await changeNickname('user-1', '  Mapsy ')).toEqual({ ok: true, value: 'Mapsy' });
    expect(updateUser).toHaveBeenCalledWith({ data: { nickname: 'Mapsy' } });
    expect(calls.find((c) => c.method === 'update')?.args[0]).toEqual({ nickname: 'Mapsy' });
    expect(calls.find((c) => c.method === 'eq')?.args).toEqual(['user_id', 'user-1']);
  });

  it('truncates an over-long nickname to 30 characters', async () => {
    queued = [{ error: null }];
    const result = await changeNickname('user-1', 'x'.repeat(50));
    expect(result).toEqual({ ok: true, value: 'x'.repeat(30) });
  });

  it('refuses an empty nickname before touching the account', async () => {
    expect((await changeNickname('user-1', '   ')).ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it('surfaces an account error and leaves the leaderboard rows alone', async () => {
    updateUser.mockResolvedValueOnce({ error: { message: 'session expired' } } as never);
    expect(await changeNickname('user-1', 'Mapsy')).toEqual({ ok: false, error: 'session expired' });
    expect(calls).toHaveLength(0);
  });

  it('still succeeds if only the leaderboard rows fail to rename', async () => {
    queued = [{ error: { message: 'boom' } }];
    expect(await changeNickname('user-1', 'Mapsy')).toEqual({ ok: true, value: 'Mapsy' });
  });
});

describe('pending entry (a guest logging in to post)', () => {
  const HOUR = 3_600_000;
  const NOW = Date.UTC(2026, 8, 20, 12);
  const daily: BoardEntry = { board: 'daily', period: '2026-09-20', score: 6100, stars: 18, achievementIds: ['big-score'] };
  const time: BoardEntry = { board: 'time', period: 'all', score: 153.2, stars: 0, achievementIds: [] };

  beforeEach(() => window.localStorage.clear());

  it('returns nothing when no entry was saved', () => {
    expect(loadPendingEntry('2026-09-20', NOW)).toBeNull();
  });

  it('returns the saved entry, surviving a reload', () => {
    savePendingEntry(time, NOW);
    expect(loadPendingEntry('2026-09-20', NOW + HOUR)).toEqual(time);
  });

  it('keeps only the latest entry', () => {
    savePendingEntry(time, NOW);
    savePendingEntry(daily, NOW);
    expect(loadPendingEntry('2026-09-20', NOW)).toEqual(daily);
  });

  it('clears the entry', () => {
    savePendingEntry(time, NOW);
    clearPendingEntry();
    expect(loadPendingEntry('2026-09-20', NOW)).toBeNull();
  });

  it('drops an entry older than a day', () => {
    savePendingEntry(time, NOW);
    expect(loadPendingEntry('2026-09-20', NOW + 24 * HOUR - 1)).toEqual(time);
    expect(loadPendingEntry('2026-09-20', NOW + 24 * HOUR + 1)).toBeNull();
  });

  it("drops a daily entry from a previous day, since that day's board is no longer shown", () => {
    savePendingEntry(daily, NOW);
    expect(loadPendingEntry('2026-09-21', NOW + HOUR)).toBeNull();
  });

  it('ignores garbage in storage', () => {
    for (const raw of ['not json', '{}', 'null', JSON.stringify({ entry: { board: 'nope' }, savedAt: NOW })]) {
      window.localStorage.setItem('mapsyquest:pending-entry', raw);
      expect(loadPendingEntry('2026-09-20', NOW)).toBeNull();
    }
    window.localStorage.setItem(
      'mapsyquest:pending-entry',
      JSON.stringify({ entry: { ...time, score: 'fast' }, savedAt: NOW }),
    );
    expect(loadPendingEntry('2026-09-20', NOW)).toBeNull();
  });
});

describe('supabase/leaderboard.sql', () => {
  const sql = leaderboardSql;

  it("range-checks daily and full-round boards at the game's real maximum", () => {
    expect(MAX_DAILY_POINTS).toBe(8400);
    expect(sql).toContain(`score between 0 and ${MAX_DAILY_POINTS}`);
  });

  it("range-checks quiz and flag boards at the game's real maximum", () => {
    expect(MAX_QUIZ_POINTS).toBe(1000);
    expect(sql).toContain(`score between 0 and ${MAX_QUIZ_POINTS}`);
  });

  it('allows exactly the boards the app has', () => {
    for (const region of ['europe', 'asia', 'americas', 'oceania', 'islands']) {
      expect(sql).toContain(region);
    }
    expect(sql).toContain("board = 'time'");
  });
});
