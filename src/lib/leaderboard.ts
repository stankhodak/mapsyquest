/**
 * Leaderboards: one row per player per board per period holding that player's best
 * score (see supabase/leaderboard.sql for the table and its rules).
 */
import { bestKey, bestValue, type GameSummary } from './achievements';
import { CHALLENGE_ROUNDS, formatChallengeTime, REGIONS, type ChallengeSetup, type RegionId } from './challenges';
import { MAX_SCORE, starMultiplier } from './points';
import { safeGetItem, safeSetItem } from './storage';
import { isSupabaseConfigured, supabase } from './supabaseClient';

const TABLE = 'mapsyquest_leaderboard';

const CATEGORY_COUNT = Object.keys(MAX_SCORE).length;
const MAX_ROUND_POINTS =
  (MAX_SCORE.country + MAX_SCORE.capital + MAX_SCORE.flag) * starMultiplier(CATEGORY_COUNT);
/** A perfect Full Round day: every step right first try, all 3 stars, over all rounds. Mirrored in the SQL range check. */
export const MAX_DAILY_POINTS = MAX_ROUND_POINTS * CHALLENGE_ROUNDS['regional-full'];
/** A perfect country-only game: every country first try. Mirrored in the SQL range check. */
export const MAX_QUIZ_POINTS = MAX_SCORE.country * CHALLENGE_ROUNDS['regional-quiz'];

export const TOP_SCORES_LIMIT = 20;
export const MAX_NICKNAME_LENGTH = 30;

/** The leaderboard is only usable once Supabase is configured. */
export const isLeaderboardAvailable = isSupabaseConfigured;

export interface BoardEntry {
  board: string;
  /** The date for the daily board, otherwise 'all'. */
  period: string;
  /** Points, or seconds for the time board. */
  score: number;
  stars: number;
  achievementIds: string[];
}

export interface BoardInfo {
  id: string;
  label: string;
}

/** Every board, in the order the leaderboard screen lists them. */
export const BOARDS: BoardInfo[] = [
  { id: 'daily', label: 'Daily challenge (today)' },
  { id: 'time', label: 'Time Challenge' },
  { id: 'flag', label: 'Flag Challenge' },
  ...REGIONS.flatMap((region) => [
    { id: `regional-full:${region.id}`, label: `${region.label} · Full Round` },
    { id: `regional-quiz:${region.id}`, label: `${region.label} · Country Quiz` },
  ]),
];

/** The game that produces a board's scores, or null for the daily board (played from the main screen). */
export function challengeForBoard(board: string): ChallengeSetup | null {
  if (board === 'time' || board === 'flag') return { kind: board };
  const [kind, region] = board.split(':');
  if ((kind === 'regional-full' || kind === 'regional-quiz') && REGIONS.some((r) => r.id === region)) {
    return { kind, region: region as RegionId };
  }
  return null;
}

export function boardLabel(board: string): string {
  return BOARDS.find((b) => b.id === board)?.label ?? board;
}

/** Short name used in sentences like "You're #3 on the Europe · Full Round board". */
export function boardShortLabel(board: string): string {
  if (board === 'daily') return 'Daily';
  return boardLabel(board);
}

/** The Time Challenge board ranks the lowest score first; every other board ranks the highest. */
export function isLowerBetter(board: string): boolean {
  return board === 'time';
}

/** The period a board's rows are filed under: today's date for the daily board, otherwise 'all'. */
export function boardPeriod(board: string, dateKey: string): string {
  return board === 'daily' ? dateKey : 'all';
}

export function formatBoardScore(board: string, score: number): string {
  return isLowerBetter(board) ? formatChallengeTime(score) : `${Math.round(score).toLocaleString()} pts`;
}

/**
 * What a finished game would post, or null if it has no postable score (e.g. a Time
 * Challenge that somehow has no time).
 */
export function buildEntry(game: GameSummary, achievementIds: string[], dateKey: string): BoardEntry | null {
  const value = bestValue(game);
  if (!Number.isFinite(value)) return null;
  const board = bestKey(game);
  // The time board stores tenths of a second; everything else is a whole number of points.
  const score = isLowerBetter(board) ? Math.round(value * 10) / 10 : Math.round(value);
  return {
    board,
    period: boardPeriod(board, dateKey),
    score,
    stars: game.rounds.reduce((sum, r) => sum + r.stars, 0),
    achievementIds,
  };
}

/**
 * The daily entry rebuilt from the saved day record, so a player who finished as a guest
 * can still post after logging in (which reloads the page) - the day's score is all it needs.
 */
export function entryFromDailyRecord(
  record: { date: string; totalPoints: number; totalStars: number },
  achievementIds: string[] = [],
): BoardEntry {
  return {
    board: 'daily',
    period: record.date,
    score: record.totalPoints,
    stars: record.totalStars,
    achievementIds,
  };
}

// --- Pending entry: a guest's score, kept across the login ------------------------------

const PENDING_KEY = 'mapsyquest:pending-entry';
/** Long enough to confirm a sign-up email, short enough that a forgotten score doesn't resurface days later. */
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Remembers the score a guest was offered, so it survives the login (Google reloads the
 * page, and any login leaves the results screen) and can be posted once they're in.
 */
export function savePendingEntry(entry: BoardEntry, now = Date.now()): void {
  safeSetItem(PENDING_KEY, JSON.stringify({ entry, savedAt: now }));
}

export function clearPendingEntry(): void {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Ignore — private browsing, blocked storage, etc.
  }
}

function isBoardEntry(value: unknown): value is BoardEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.board === 'string' &&
    BOARDS.some((b) => b.id === e.board) &&
    typeof e.period === 'string' &&
    typeof e.score === 'number' &&
    Number.isFinite(e.score) &&
    typeof e.stars === 'number' &&
    Number.isFinite(e.stars) &&
    Array.isArray(e.achievementIds) &&
    e.achievementIds.every((id) => typeof id === 'string')
  );
}

/** The saved entry, or null if there is none, it's unreadable, too old, or a past day's daily score. */
export function loadPendingEntry(dateKey: string, now = Date.now()): BoardEntry | null {
  const raw = safeGetItem(PENDING_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as { entry?: unknown; savedAt?: unknown } | null;
    if (!saved || typeof saved.savedAt !== 'number' || now - saved.savedAt > PENDING_MAX_AGE_MS) return null;
    if (!isBoardEntry(saved.entry)) return null;
    if (saved.entry.board === 'daily' && saved.entry.period !== dateKey) return null;
    return saved.entry;
  } catch {
    return null;
  }
}

/** True if `score` should sit above `other` on the given board. */
export function ranksAbove(board: string, score: number, other: number): boolean {
  return isLowerBetter(board) ? score < other : score > other;
}

// --- Supabase access ---------------------------------------------------------------

export interface LeaderboardRow {
  userId: string;
  nickname: string;
  score: number;
  stars: number;
}

export type LeaderboardResult<T> = { ok: true; value: T } | { ok: false; error: string };

const UNAVAILABLE = 'Leaderboards are not set up yet.';

function toRow(raw: { user_id: string; nickname: string; score: number | string; stars: number }): LeaderboardRow {
  return { userId: raw.user_id, nickname: raw.nickname, score: Number(raw.score), stars: raw.stars };
}

/** The best scores on a board, best first. */
export async function fetchTopScores(
  board: string,
  period: string,
  limit = TOP_SCORES_LIMIT,
): Promise<LeaderboardResult<LeaderboardRow[]>> {
  if (!supabase) return { ok: false, error: UNAVAILABLE };
  const { data, error } = await supabase
    .from(TABLE)
    .select('user_id, nickname, score, stars')
    .eq('board', board)
    .eq('period', period)
    .order('score', { ascending: isLowerBetter(board) })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map(toRow) };
}

/** 1-based place a score would take on a board, counting only strictly better scores ahead of it. */
export async function fetchRank(board: string, period: string, score: number): Promise<LeaderboardResult<number>> {
  if (!supabase) return { ok: false, error: UNAVAILABLE };
  const query = supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('board', board)
    .eq('period', period);
  const { count, error } = await (isLowerBetter(board) ? query.lt('score', score) : query.gt('score', score));
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (count ?? 0) + 1 };
}

export interface SubmitOutcome {
  /** False when the player already had an equal or better score on this board, which is kept. */
  improved: boolean;
  /** The player's place on the board after posting. */
  rank: number | null;
}

/**
 * Posts a score, keeping the player's best: a worse or equal score than the one already
 * saved for this board and period leaves it untouched.
 */
export async function submitScore(
  userId: string,
  nickname: string,
  entry: BoardEntry,
): Promise<LeaderboardResult<SubmitOutcome>> {
  if (!supabase) return { ok: false, error: UNAVAILABLE };
  const cleanNickname = nickname.trim().slice(0, MAX_NICKNAME_LENGTH);
  if (!cleanNickname) return { ok: false, error: 'Please choose a nickname first.' };

  const existing = await supabase
    .from(TABLE)
    .select('score')
    .eq('user_id', userId)
    .eq('board', entry.board)
    .eq('period', entry.period)
    .maybeSingle();
  if (existing.error) return { ok: false, error: existing.error.message };

  const previous = existing.data ? Number(existing.data.score) : null;
  const improved = previous === null || ranksAbove(entry.board, entry.score, previous);

  if (improved) {
    const { error } = await supabase.from(TABLE).upsert(
      {
        user_id: userId,
        nickname: cleanNickname,
        board: entry.board,
        period: entry.period,
        score: entry.score,
        stars: entry.stars,
        achievements: entry.achievementIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,board,period' },
    );
    if (error) return { ok: false, error: error.message };
  }

  const rank = await fetchRank(entry.board, entry.period, improved ? entry.score : (previous as number));
  return { ok: true, value: { improved, rank: rank.ok ? rank.value : null } };
}

/** Remembers the nickname on the account so it's prefilled next time. Failure is harmless. */
export async function saveNickname(nickname: string): Promise<void> {
  await supabase?.auth.updateUser({ data: { nickname: nickname.trim().slice(0, MAX_NICKNAME_LENGTH) } });
}

/**
 * Changes the player's nickname: on the account (works the same for email and Google
 * logins) and on every leaderboard row they already have, so old scores don't keep the old
 * name. Renaming the rows is best-effort - the account is the source of truth, and the
 * next posted score carries the new name anyway.
 */
export async function changeNickname(userId: string, nickname: string): Promise<LeaderboardResult<string>> {
  if (!supabase) return { ok: false, error: UNAVAILABLE };
  const cleanNickname = nickname.trim().slice(0, MAX_NICKNAME_LENGTH);
  if (!cleanNickname) return { ok: false, error: 'Please enter a nickname.' };

  const account = await supabase.auth.updateUser({ data: { nickname: cleanNickname } });
  if (account.error) return { ok: false, error: account.error.message };

  const rows = await supabase.from(TABLE).update({ nickname: cleanNickname }).eq('user_id', userId);
  if (rows.error) console.error('Renaming leaderboard rows failed:', rows.error.message);
  return { ok: true, value: cleanNickname };
}

/** The nickname to prefill on the post form: a saved nickname, else the first name Google shared, else empty. */
export function suggestedNickname(metadata: Record<string, unknown> | undefined): string {
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const nickname = text(metadata?.nickname);
  if (nickname) return nickname.slice(0, MAX_NICKNAME_LENGTH);
  const fullName = text(metadata?.full_name) || text(metadata?.name);
  return fullName.split(/\s+/)[0]?.slice(0, MAX_NICKNAME_LENGTH) ?? '';
}
