import { track } from '@vercel/analytics/react';
import { isPostHogTracking, posthog } from './posthogClient';

/**
 * Game-lifecycle events sent to both Vercel Web Analytics (simple counts, cookieless — sent
 * regardless of cookie consent) and PostHog (funnels/drop-off analysis, gated on the player
 * having accepted analytics cookies — see posthogClient.ts). Kept spoiler-free and free of
 * any personally identifying data — no country/capital/flag answers, no email or nickname.
 */
function sendEvent(name: string, properties?: Record<string, number>): void {
  track(name, properties);
  if (isPostHogTracking()) posthog.capture(name, properties);
}

/** Fired once per daily game, when Play starts it fresh (not when resuming it). If analytics
 * cookies aren't accepted yet only Vercel counts it, and trackLateGameStart may send
 * PostHog's copy later. */
export function trackGameStarted(): void {
  sendEvent('game_started');
}

/** PostHog's copy of a game_started that Vercel already counted while PostHog wasn't
 * allowed to capture — sent once the player accepts analytics part-way through (or comes
 * back to) that same game, so its rounds and completion aren't left without a start.
 * Timestamped at the original start, and tagged afterConsent so it can be told apart. */
export function trackLateGameStart(startedAt: number): void {
  if (!isPostHogTracking()) return;
  posthog.capture('game_started', { afterConsent: 1 }, { timestamp: new Date(startedAt) });
}

/** Fired every time a round finishes (win or skip), so the per-round counts show where in
 * the 7 rounds players tend to be when they stop. */
export function trackRoundCompleted(round: number, stars: number, points: number): void {
  sendEvent('round_completed', { round, stars, points });
}

/** Fired once, when the final round finishes — completions ÷ game_started ≈ completion rate. */
export function trackGameCompleted(totalStars: number, totalPoints: number, totalRounds: number): void {
  sendEvent('game_completed', { totalStars, totalPoints, totalRounds });
}

/** Fired when a player leaves mid-game (tab closed/navigated away before finishing all
 * rounds), tagged with which round they were on. Approximate by nature — there's no
 * reliable way to distinguish "closed the tab" from "will resume tomorrow", since the
 * day-lock only prevents replay after a full completion. */
export function trackGameAbandoned(atRound: number): void {
  sendEvent('game_abandoned', { atRound });
}

/** Fired alongside game_completed with the wall-clock time (in seconds) from first pressing
 * Play to finishing the last round. A resumed game keeps its original start, so this
 * includes any time spent away from the game (other screens, a closed tab) — it is elapsed
 * time, not active playing time. */
export function trackGameDuration(seconds: number): void {
  sendEvent('game_duration', { seconds });
}

/** What pressing Play should report: 'new' for a fresh game (game_started to Vercel, and to
 * PostHog if it's capturing), 'late' for a resumed game whose start PostHog never got and now
 * can (trackLateGameStart), or null. `startTracked` is the updated "PostHog has this game's
 * start" flag to keep with the game's saved progress. */
export function gameStartOnPlay(state: {
  hasDailyProgress: boolean;
  startTracked: boolean;
  posthogTracking: boolean;
}): { report: 'new' | 'late' | null; startTracked: boolean } {
  if (!state.hasDailyProgress) return { report: 'new', startTracked: state.posthogTracking };
  if (state.posthogTracking && !state.startTracked) return { report: 'late', startTracked: true };
  return { report: null, startTracked: state.startTracked };
}

/** When the player turns analytics on: a game being played right now whose start PostHog
 * missed gets its late start; anything else waits for Play (gameStartOnPlay). */
export function gameStartOnConsent(state: {
  playing: boolean;
  startTracked: boolean;
}): { report: 'late' | null; startTracked: boolean } {
  if (state.playing && !state.startTracked) return { report: 'late', startTracked: true };
  return { report: null, startTracked: state.startTracked };
}

/** Whether leaving the page now counts as abandoning the daily game: Play was pressed this
 * visit and not every round is done yet. */
export function isGameAbandonedOnLeave(gameStartedAt: number | null, roundIndex: number, totalRounds: number): boolean {
  return gameStartedAt !== null && roundIndex < totalRounds;
}

/** Whole seconds from the game's first Play to now, never negative (a clock moved back). */
export function elapsedGameSeconds(startedAt: number, finishedAt: number): number {
  return Math.max(0, Math.round((finishedAt - startedAt) / 1000));
}
