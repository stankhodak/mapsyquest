/**
 * Day-lock + streak persistence, entirely client-side via localStorage — no
 * backend, same approach Wordle uses. Wrapped in try/catch since localStorage
 * can throw (private browsing, blocked storage, quota) and a missing streak
 * shouldn't break the game.
 */

const RESULT_KEY_PREFIX = 'mapsyquest:result:';
const STREAK_KEY = 'mapsyquest:streak';

export interface StoredRoundResult {
  countryId: string;
  countryName: string;
  stars: number;
  points: number;
}

export interface StoredDailyRecord {
  date: string;
  results: StoredRoundResult[];
  totalStars: number;
  totalPoints: number;
}

export interface StreakState {
  currentStreak: number;
  maxStreak: number;
  lastCompletedDate: string | null;
}

const EMPTY_STREAK: StreakState = { currentStreak: 0, maxStreak: 0, lastCompletedDate: null };

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore — private browsing, blocked storage, quota, etc.
  }
}

/** Technical/testing helper: clears today's completion lock so the day can be replayed. Leaves the streak untouched. */
export function clearDailyRecord(dateKey: string): void {
  try {
    window.localStorage.removeItem(RESULT_KEY_PREFIX + dateKey);
  } catch {
    // Ignore — private browsing, blocked storage, etc.
  }
}

export function loadDailyRecord(dateKey: string): StoredDailyRecord | null {
  const raw = safeGetItem(RESULT_KEY_PREFIX + dateKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredDailyRecord;
  } catch {
    return null;
  }
}

export function loadStreak(): StreakState {
  const raw = safeGetItem(STREAK_KEY);
  if (!raw) return EMPTY_STREAK;
  try {
    return JSON.parse(raw) as StreakState;
  } catch {
    return EMPTY_STREAK;
  }
}

function daysBetween(fromDateKey: string, toDateKey: string): number {
  const from = new Date(`${fromDateKey}T00:00:00`);
  const to = new Date(`${toDateKey}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** Persists today's completed round results and updates the streak. Returns the new streak state. */
export function saveDailyCompletion(record: StoredDailyRecord): StreakState {
  safeSetItem(RESULT_KEY_PREFIX + record.date, JSON.stringify(record));

  const streak = loadStreak();
  let currentStreak: number;
  if (streak.lastCompletedDate === record.date) {
    currentStreak = streak.currentStreak;
  } else if (streak.lastCompletedDate && daysBetween(streak.lastCompletedDate, record.date) === 1) {
    currentStreak = streak.currentStreak + 1;
  } else {
    currentStreak = 1;
  }

  const next: StreakState = {
    currentStreak,
    maxStreak: Math.max(streak.maxStreak, currentStreak),
    lastCompletedDate: record.date,
  };
  safeSetItem(STREAK_KEY, JSON.stringify(next));
  return next;
}
