import { beforeEach, describe, expect, it } from 'vitest';
import {
  adoptGuestData,
  loadDailyRecord,
  loadStreak,
  saveDailyCompletion,
  scopedKey,
  type StoredDailyRecord,
} from '../storage';

const TODAY = '2026-09-21';
const YESTERDAY = '2026-09-20';

function record(date: string, totalPoints: number): StoredDailyRecord {
  return { date, results: [], totalStars: 5, totalPoints };
}

beforeEach(() => window.localStorage.clear());

describe('per-owner daily data', () => {
  it('keeps a guest on the original keys, so records saved before accounts were scoped still load', () => {
    expect(scopedKey(`result:${TODAY}`, null)).toBe(`mapsyquest:result:${TODAY}`);
    expect(scopedKey('streak', null)).toBe('mapsyquest:streak');
    expect(scopedKey('achievements', null)).toBe('mapsyquest:achievements');
  });

  it("doesn't show one account's result or streak to another account or a guest", () => {
    saveDailyCompletion(record(TODAY, 4000), 'account-a');

    expect(loadDailyRecord(TODAY, 'account-a')?.totalPoints).toBe(4000);
    expect(loadStreak('account-a').currentStreak).toBe(1);

    expect(loadDailyRecord(TODAY, 'account-b')).toBeNull();
    expect(loadStreak('account-b').currentStreak).toBe(0);
    expect(loadDailyRecord(TODAY, null)).toBeNull();
    expect(loadStreak(null).currentStreak).toBe(0);
  });
});

describe('adoptGuestData', () => {
  it("gives a guest's finished day to the account that logs in, and leaves the guest slot empty", () => {
    saveDailyCompletion(record(TODAY, 4000), null);

    adoptGuestData('account-a', TODAY);

    expect(loadDailyRecord(TODAY, 'account-a')?.totalPoints).toBe(4000);
    expect(loadStreak('account-a').currentStreak).toBe(1);
    expect(loadDailyRecord(TODAY, null)).toBeNull();
    expect(loadStreak(null).currentStreak).toBe(0);
  });

  it("continues the account's own streak rather than replacing it", () => {
    saveDailyCompletion(record(YESTERDAY, 3000), 'account-a');
    saveDailyCompletion(record(TODAY, 4000), null);

    adoptGuestData('account-a', TODAY);

    expect(loadStreak('account-a')).toEqual({ currentStreak: 2, maxStreak: 2, lastCompletedDate: TODAY });
  });

  it("doesn't overwrite a result the account already has for today", () => {
    saveDailyCompletion(record(TODAY, 6000), 'account-a');
    saveDailyCompletion(record(TODAY, 1000), null);

    adoptGuestData('account-a', TODAY);

    expect(loadDailyRecord(TODAY, 'account-a')?.totalPoints).toBe(6000);
    expect(loadDailyRecord(TODAY, null)?.totalPoints).toBe(1000);
  });

  it("hands the guest's achievements and older streak to an account that has none", () => {
    window.localStorage.setItem('mapsyquest:achievements', '{"dailyGames":3}');
    window.localStorage.setItem(
      'mapsyquest:streak',
      JSON.stringify({ currentStreak: 3, maxStreak: 4, lastCompletedDate: YESTERDAY }),
    );

    adoptGuestData('account-a', TODAY);

    expect(window.localStorage.getItem(scopedKey('achievements', 'account-a'))).toBe('{"dailyGames":3}');
    expect(loadStreak('account-a').maxStreak).toBe(4);
    expect(window.localStorage.getItem('mapsyquest:achievements')).toBeNull();
  });

  it("keeps an account's own achievements when the guest has some too", () => {
    window.localStorage.setItem('mapsyquest:achievements', '{"dailyGames":1}');
    window.localStorage.setItem(scopedKey('achievements', 'account-a'), '{"dailyGames":9}');

    adoptGuestData('account-a', TODAY);

    expect(window.localStorage.getItem(scopedKey('achievements', 'account-a'))).toBe('{"dailyGames":9}');
  });

  it("does nothing when there's no guest data", () => {
    adoptGuestData('account-a', TODAY);

    expect(loadDailyRecord(TODAY, 'account-a')).toBeNull();
    expect(loadStreak('account-a').currentStreak).toBe(0);
  });
});
