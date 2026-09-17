import { track } from '@vercel/analytics/react';

/**
 * Game-lifecycle events sent to Vercel Web Analytics. Kept spoiler-free and free of any
 * personally identifying data — no country/capital/flag answers, no email or nickname.
 */

/** Fired once per browser per day (the day-lock prevents replay), so this event's daily
 * count in the Vercel Analytics dashboard is a reasonable stand-in for "unique players
 * per day" — how many visitors actually start playing, not just land on the page. */
export function trackGameStarted(): void {
  track('game_started');
}

/** Fired every time a round finishes (win or skip), so the per-round counts show where in
 * the 7 rounds players tend to be when they stop. */
export function trackRoundCompleted(round: number, stars: number, points: number): void {
  track('round_completed', { round, stars, points });
}

/** Fired once, when the final round finishes — completions ÷ game_started ≈ completion rate. */
export function trackGameCompleted(totalStars: number, totalPoints: number, totalRounds: number): void {
  track('game_completed', { totalStars, totalPoints, totalRounds });
}

/** Fired when a player leaves mid-game (tab closed/navigated away before finishing all
 * rounds), tagged with which round they were on. Approximate by nature — there's no
 * reliable way to distinguish "closed the tab" from "will resume tomorrow", since the
 * day-lock only prevents replay after a full completion. */
export function trackGameAbandoned(atRound: number): void {
  track('game_abandoned', { atRound });
}

/** Fired alongside game_completed with the wall-clock time (in seconds) from pressing
 * Play to finishing the last round. */
export function trackGameDuration(seconds: number): void {
  track('game_duration', { seconds });
}
