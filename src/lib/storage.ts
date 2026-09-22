/**
 * Day-lock + streak persistence, entirely client-side via localStorage — no
 * backend, same approach Wordle uses. Wrapped in try/catch since localStorage
 * can throw (private browsing, blocked storage, quota) and a missing streak
 * shouldn't break the game.
 */
import type { StarTier } from './points';

/**
 * Whose data this is: an account's user id, or null for a guest. localStorage belongs to
 * the browser, not the login, so each account gets its own keys - otherwise whoever logs in
 * next on the same device would see (and post) the previous player's day. A guest keeps the
 * original un-prefixed keys, which is also where data saved before this scoping lives.
 */
export type StorageOwner = string | null;

export function scopedKey(name: string, owner: StorageOwner): string {
  return owner ? `mapsyquest:u:${owner}:${name}` : `mapsyquest:${name}`;
}

const resultName = (dateKey: string) => `result:${dateKey}`;

export interface StoredRoundResult {
  countryId: string;
  countryName: string;
  stars: number;
  points: number;
  /** Per-category medal tiers ('gold'/'silver'/'bronze'/null). Optional: records saved
   * before tiers existed won't have this — readers should treat a missing tiers object
   * the same as all-null (tierIcon already renders undefined as a miss). */
  tiers?: { country: StarTier; capital: StarTier; flag: StarTier };
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

export function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore — private browsing, blocked storage, quota, etc.
  }
}

function safeRemoveItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore — private browsing, blocked storage, etc.
  }
}

/** Technical/testing helper: clears today's completion lock so the day can be replayed. Leaves the streak untouched. */
export function clearDailyRecord(dateKey: string, owner: StorageOwner = null): void {
  safeRemoveItem(scopedKey(resultName(dateKey), owner));
}

export function loadDailyRecord(dateKey: string, owner: StorageOwner = null): StoredDailyRecord | null {
  const raw = safeGetItem(scopedKey(resultName(dateKey), owner));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredDailyRecord;
  } catch {
    return null;
  }
}

export function loadStreak(owner: StorageOwner = null): StreakState {
  const raw = safeGetItem(scopedKey('streak', owner));
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
export function saveDailyCompletion(record: StoredDailyRecord, owner: StorageOwner = null): StreakState {
  safeSetItem(scopedKey(resultName(record.date), owner), JSON.stringify(record));

  const streak = loadStreak(owner);
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
  safeSetItem(scopedKey('streak', owner), JSON.stringify(next));
  return next;
}

/**
 * Hands what a guest saved on this device to the account that has just logged in, so a
 * game finished before logging in still counts (and can still be posted). Only fills gaps:
 * the account's own result, streak and achievements are never overwritten. The guest's
 * finished day goes through saveDailyCompletion so it extends the account's own streak.
 */
export function adoptGuestData(userId: string, dateKey: string): void {
  const guestResultKey = scopedKey(resultName(dateKey), null);
  const guestRecord = loadDailyRecord(dateKey, null);
  if (guestRecord && !loadDailyRecord(dateKey, userId)) {
    saveDailyCompletion(guestRecord, userId);
    safeRemoveItem(guestResultKey);
    safeRemoveItem(scopedKey('streak', null));
  }

  for (const name of ['streak', 'achievements']) {
    const guestValue = safeGetItem(scopedKey(name, null));
    if (guestValue !== null && safeGetItem(scopedKey(name, userId)) === null) {
      safeSetItem(scopedKey(name, userId), guestValue);
      safeRemoveItem(scopedKey(name, null));
    }
  }
}
