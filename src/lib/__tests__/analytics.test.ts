import { describe, expect, it } from 'vitest';
import { elapsedGameSeconds, gameStartOnConsent, gameStartOnPlay, isGameAbandonedOnLeave } from '../analytics';

describe('gameStartOnPlay', () => {
  it('counts a fresh game once, in PostHog too when analytics is on', () => {
    expect(gameStartOnPlay({ hasDailyProgress: false, startTracked: true, posthogTracking: true })).toEqual({
      report: 'new',
      startTracked: true,
    });
  });

  it('still counts a fresh game before consent, but remembers PostHog missed it', () => {
    expect(gameStartOnPlay({ hasDailyProgress: false, startTracked: true, posthogTracking: false })).toEqual({
      report: 'new',
      startTracked: false,
    });
  });

  it('does not count a resumed game again', () => {
    expect(gameStartOnPlay({ hasDailyProgress: true, startTracked: true, posthogTracking: true })).toEqual({
      report: null,
      startTracked: true,
    });
  });

  it('gives PostHog the missed start when a pre-consent game is resumed with analytics on', () => {
    expect(gameStartOnPlay({ hasDailyProgress: true, startTracked: false, posthogTracking: true })).toEqual({
      report: 'late',
      startTracked: true,
    });
  });

  it('keeps waiting while a pre-consent game is resumed without consent', () => {
    expect(gameStartOnPlay({ hasDailyProgress: true, startTracked: false, posthogTracking: false })).toEqual({
      report: null,
      startTracked: false,
    });
  });
});

describe('gameStartOnConsent', () => {
  it('sends the missed start when analytics is accepted mid-game', () => {
    expect(gameStartOnConsent({ playing: true, startTracked: false })).toEqual({ report: 'late', startTracked: true });
  });

  it('sends nothing when the start already reached PostHog', () => {
    expect(gameStartOnConsent({ playing: true, startTracked: true })).toEqual({ report: null, startTracked: true });
  });

  it('leaves a game not being played to the next Play', () => {
    expect(gameStartOnConsent({ playing: false, startTracked: false })).toEqual({ report: null, startTracked: false });
  });
});

describe('game_started across a whole game', () => {
  /** Plays the start-tracking decisions through a sequence of visits, collecting what's sent. */
  function simulate(steps: Array<'play' | 'consent' | 'reload'>, startConsented: boolean) {
    const sent: string[] = [];
    let consented = startConsented;
    let hasDailyProgress = false;
    let playing = false;
    // A brand-new game has no saved flag; App defaults it to true until Play decides.
    let startTracked = true;
    for (const step of steps) {
      if (step === 'play') {
        const start = gameStartOnPlay({ hasDailyProgress, startTracked, posthogTracking: consented });
        if (start.report) sent.push(start.report);
        startTracked = start.startTracked;
        hasDailyProgress = true; // RoundFlow saves the round as soon as it mounts
        playing = true;
      } else if (step === 'consent') {
        consented = true;
        const start = gameStartOnConsent({ playing, startTracked });
        if (start.report) sent.push(start.report);
        startTracked = start.startTracked;
      } else {
        playing = false; // a reload restores progress and startTracked, but not "playing"
      }
    }
    return sent;
  }

  it('consent before starting: one start, no late copy', () => {
    expect(simulate(['play', 'reload', 'play'], true)).toEqual(['new']);
  });

  it('consent after starting, mid-game: one start plus PostHog late copy', () => {
    expect(simulate(['play', 'consent', 'reload', 'play'], false)).toEqual(['new', 'late']);
  });

  it('consent on a later visit, then resume: the late copy is sent once', () => {
    expect(simulate(['play', 'reload', 'consent', 'play', 'reload', 'play'], false)).toEqual(['new', 'late']);
  });

  it('leaving and re-entering the same game never re-sends', () => {
    expect(simulate(['play', 'play', 'reload', 'play', 'play'], true)).toEqual(['new']);
  });
});

describe('isGameAbandonedOnLeave', () => {
  it('counts leaving part-way through a game played this visit', () => {
    expect(isGameAbandonedOnLeave(1000, 3, 7)).toBe(true);
  });

  it('ignores a visit where Play was never pressed', () => {
    expect(isGameAbandonedOnLeave(null, 3, 7)).toBe(false);
  });

  it('ignores leaving after the last round', () => {
    expect(isGameAbandonedOnLeave(1000, 7, 7)).toBe(false);
  });
});

describe('elapsedGameSeconds', () => {
  it('rounds wall-clock time to whole seconds', () => {
    expect(elapsedGameSeconds(0, 125_400)).toBe(125);
    expect(elapsedGameSeconds(0, 125_600)).toBe(126);
  });

  it('includes time away from a resumed game (elapsed, not active, time)', () => {
    const startedAt = Date.UTC(2026, 10, 5, 9, 0, 0);
    // 5 minutes of play, an hour away, then 4m 57s more: all of it counts.
    const finishedAt = startedAt + (5 * 60 + 60 * 60 + 4 * 60 + 57) * 1000;
    expect(elapsedGameSeconds(startedAt, finishedAt)).toBe(69 * 60 + 57);
  });

  it('never goes negative if the clock moved back', () => {
    expect(elapsedGameSeconds(10_000, 5_000)).toBe(0);
  });
});
