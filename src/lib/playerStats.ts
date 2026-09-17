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

export async function fetchPlayerStats(userId: string): Promise<PlayerStats> {
  if (!supabase) return EMPTY_STATS;
  const { data } = await supabase
    .from(TABLE)
    .select('games_played, total_stars, total_points, best_stars, best_points, current_streak, max_streak')
    .eq('user_id', userId)
    .maybeSingle();
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

/** Called once per completed game while logged in. Adds this game's stars/points on top
 * of whatever's already saved, bumps the best-single-game records if beaten, and
 * overwrites the streak with the freshly computed local value (lib/storage.ts already
 * handles day-continuity logic) — this is a fetch-then-write, not an atomic increment,
 * which is fine for one browser completing one game at a time. */
export async function recordCompletedGame(
  userId: string,
  gameStars: number,
  gamePoints: number,
  streak: { currentStreak: number; maxStreak: number },
): Promise<void> {
  if (!supabase) return;
  const existing = await fetchPlayerStats(userId);
  await supabase.from(TABLE).upsert({
    user_id: userId,
    games_played: existing.gamesPlayed + 1,
    total_stars: existing.totalStars + gameStars,
    total_points: existing.totalPoints + gamePoints,
    best_stars: Math.max(existing.bestStars, gameStars),
    best_points: Math.max(existing.bestPoints, gamePoints),
    current_streak: streak.currentStreak,
    max_streak: streak.maxStreak,
    updated_at: new Date().toISOString(),
  });
}
