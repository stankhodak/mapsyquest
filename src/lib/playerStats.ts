import { supabase } from './supabaseClient';

/** Table name is prefixed since this Supabase project is shared with another app —
 * keeps it unambiguous in the dashboard and avoids any collision. */
const TABLE = 'mapsyquest_player_stats';

export interface PlayerStats {
  gamesPlayed: number;
  totalStars: number;
  totalPoints: number;
  /** Highest stars/points earned in a single game, not a lifetime total. */
  bestStars: number;
  bestPoints: number;
  currentStreak: number;
  maxStreak: number;
}

const EMPTY_STATS: PlayerStats = {
  gamesPlayed: 0,
  totalStars: 0,
  totalPoints: 0,
  bestStars: 0,
  bestPoints: 0,
  currentStreak: 0,
  maxStreak: 0,
};

/** Throws if the read fails, so a broken table or policy shows up as an error instead of as a wall of zeroes. */
export async function fetchPlayerStats(userId: string): Promise<PlayerStats> {
  if (!supabase) return EMPTY_STATS;
  const { data, error } = await supabase
    .from(TABLE)
    .select('games_played, total_stars, total_points, best_stars, best_points, current_streak, max_streak')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return EMPTY_STATS;
  return {
    gamesPlayed: data.games_played,
    totalStars: data.total_stars,
    totalPoints: data.total_points,
    bestStars: data.best_stars,
    bestPoints: data.best_points,
    currentStreak: data.current_streak,
    maxStreak: data.max_streak,
  };
}

/** The saved stats after one more finished game: totals grow, bests only rise, and the
 * streak is replaced by the given one (or kept, for games that don't touch the daily streak). */
export function applyCompletedGame(
  existing: PlayerStats,
  gameStars: number,
  gamePoints: number,
  streak?: { currentStreak: number; maxStreak: number },
): PlayerStats {
  return {
    gamesPlayed: existing.gamesPlayed + 1,
    totalStars: existing.totalStars + gameStars,
    totalPoints: existing.totalPoints + gamePoints,
    bestStars: Math.max(existing.bestStars, gameStars),
    bestPoints: Math.max(existing.bestPoints, gamePoints),
    currentStreak: streak?.currentStreak ?? existing.currentStreak,
    maxStreak: streak?.maxStreak ?? existing.maxStreak,
  };
}

/** Called once per completed game (the daily game or any challenge) while logged in. Adds
 * this game on top of whatever's already saved — see applyCompletedGame. The daily game
 * passes its freshly computed streak (lib/storage.ts already handles day-continuity
 * logic); challenges omit it. This is a fetch-then-write, not an atomic increment, which
 * is fine for one browser completing one game at a time. Failures are logged rather than
 * thrown: a stats hiccup must never break the end of a game. */
export async function recordCompletedGame(
  userId: string,
  gameStars: number,
  gamePoints: number,
  streak?: { currentStreak: number; maxStreak: number },
): Promise<void> {
  if (!supabase) return;
  try {
    const next = applyCompletedGame(await fetchPlayerStats(userId), gameStars, gamePoints, streak);
    const { error } = await supabase.from(TABLE).upsert({
      user_id: userId,
      games_played: next.gamesPlayed,
      total_stars: next.totalStars,
      total_points: next.totalPoints,
      best_stars: next.bestStars,
      best_points: next.bestPoints,
      current_streak: next.currentStreak,
      max_streak: next.maxStreak,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error('Saving player stats failed:', error);
  }
}
