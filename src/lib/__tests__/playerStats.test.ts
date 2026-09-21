import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseClient', () => ({ isSupabaseConfigured: false, supabase: null }));

const { applyCompletedGame } = await import('../playerStats');

const existing = {
  gamesPlayed: 4,
  totalStars: 20,
  totalPoints: 3000,
  bestStars: 9,
  bestPoints: 1200,
  currentStreak: 3,
  maxStreak: 5,
};

describe('applyCompletedGame', () => {
  it('adds the game to the totals and counts it as played', () => {
    const next = applyCompletedGame(existing, 4, 500);
    expect(next.gamesPlayed).toBe(5);
    expect(next.totalStars).toBe(24);
    expect(next.totalPoints).toBe(3500);
  });

  it('raises a best only when the game beats it', () => {
    expect(applyCompletedGame(existing, 12, 2000)).toMatchObject({ bestStars: 12, bestPoints: 2000 });
    expect(applyCompletedGame(existing, 2, 100)).toMatchObject({ bestStars: 9, bestPoints: 1200 });
  });

  it('takes the streak it is given, and keeps the saved one for games that do not touch the daily streak', () => {
    expect(applyCompletedGame(existing, 1, 1, { currentStreak: 6, maxStreak: 6 })).toMatchObject({
      currentStreak: 6,
      maxStreak: 6,
    });
    expect(applyCompletedGame(existing, 1, 1)).toMatchObject({ currentStreak: 3, maxStreak: 5 });
  });

  it('starts a first-ever game from empty stats', () => {
    const empty = { ...existing, gamesPlayed: 0, totalStars: 0, totalPoints: 0, bestStars: 0, bestPoints: 0, currentStreak: 0, maxStreak: 0 };
    expect(applyCompletedGame(empty, 3, 900)).toMatchObject({ gamesPlayed: 1, bestStars: 3, bestPoints: 900 });
  });
});
