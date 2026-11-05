import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildReportMessage,
  buildVisitsMessage,
  countsQuery,
  dateRangeFilter,
  durationQuery,
  formatDuration,
  last7DaysRange,
  todayRange,
  yesterdayRange,
} from './analytics.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('report date ranges (Europe/Madrid)', () => {
  it('covers today plus the 6 days before it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
    expect(last7DaysRange()).toEqual({ startDateKey: '2026-10-30', endDateKey: '2026-11-05' });
    expect(todayRange()).toEqual({ startDateKey: '2026-11-05', endDateKey: '2026-11-05' });
    expect(yesterdayRange()).toEqual({ startDateKey: '2026-11-04', endDateKey: '2026-11-04' });
  });

  it("uses Madrid's date, not UTC's, just after Madrid midnight", () => {
    vi.useFakeTimers();
    // 23:30 UTC on the 4th is 00:30 on the 5th in Madrid (CET, UTC+1).
    vi.setSystemTime(new Date('2026-11-04T23:30:00Z'));
    expect(last7DaysRange()).toEqual({ startDateKey: '2026-10-30', endDateKey: '2026-11-05' });
  });

  it('spans a DST change as 7 calendar days', () => {
    vi.useFakeTimers();
    // Madrid left summer time on 2026-10-25.
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'));
    expect(last7DaysRange()).toEqual({ startDateKey: '2026-10-22', endDateKey: '2026-10-28' });
  });

  it('crosses month and year boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-03T12:00:00Z'));
    expect(last7DaysRange()).toEqual({ startDateKey: '2026-12-28', endDateKey: '2027-01-03' });
  });

  it('buckets events by their Madrid calendar date, inclusive at both ends', () => {
    const filter = dateRangeFilter({ startDateKey: '2026-10-30', endDateKey: '2026-11-05' });
    expect(filter).toBe(
      "toDate(toTimeZone(timestamp, 'Europe/Madrid')) >= toDate('2026-10-30') AND " +
        "toDate(toTimeZone(timestamp, 'Europe/Madrid')) <= toDate('2026-11-05')",
    );
  });
});

describe('report queries', () => {
  const week = { startDateKey: '2026-10-30', endDateKey: '2026-11-05' };

  it('counts players from every game event, not only game_started', () => {
    const query = countsQuery(week);
    expect(query).toContain('uniq(distinct_id) AS players');
    expect(query).not.toContain('uniqIf');
    expect(query).toContain("WHERE event IN ('game_started', 'game_completed', 'round_completed')");
    expect(query).toContain(dateRangeFilter(week));
  });

  it('counts starts, completions and rounds per event', () => {
    const query = countsQuery(week);
    expect(query).toContain("countIf(event = 'game_started') AS games_started");
    expect(query).toContain("countIf(event = 'game_completed') AS games_completed");
    expect(query).toContain("countIf(event = 'round_completed') AS rounds_completed");
  });

  it('reads durations from game_duration in the same window, with how many games', () => {
    const query = durationQuery(week);
    expect(query).toContain("WHERE event = 'game_duration'");
    expect(query).toContain('count() AS games');
    expect(query).toContain(dateRangeFilter(week));
  });
});

describe('buildReportMessage', () => {
  it('labels the duration as elapsed time to finish, with its sample size', () => {
    const message = buildReportMessage(
      'Last 7 days',
      { players: 1, gamesStarted: 0, gamesCompleted: 2, roundsCompleted: 12 },
      { avgSeconds: 4197, medianSeconds: 4197, games: 2 },
    );
    expect(message).toContain('Players: 1');
    expect(message).toContain('Avg time to finish: 69m 57s');
    expect(message).toContain('Median time to finish: 69m 57s');
    expect(message).toContain('(first Play to last round, incl. time away; 2 games)');
    expect(message).toContain('PostHog only');
    // No completion rate without any starts to divide by.
    expect(message).not.toContain('Completion rate');
  });

  it('omits duration lines when no game finished', () => {
    const message = buildReportMessage(
      'Today',
      { players: 0, gamesStarted: 0, gamesCompleted: 0, roundsCompleted: 0 },
      { avgSeconds: null, medianSeconds: null, games: 0 },
    );
    expect(message).not.toContain('time to finish');
    expect(message).not.toContain('incl. time away');
  });

  it('shows the completion rate when there are starts', () => {
    const message = buildReportMessage(
      'Today',
      { players: 3, gamesStarted: 4, gamesCompleted: 3, roundsCompleted: 25 },
      { avgSeconds: 300, medianSeconds: 280, games: 1 },
    );
    expect(message).toContain('Completion rate: 75.0%');
    expect(message).toContain('1 game)');
  });
});

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(4197)).toBe('69m 57s');
    expect(formatDuration(59.6)).toBe('1m 0s');
  });
});

describe('buildVisitsMessage', () => {
  it('lists each window and says these are page loads', () => {
    const message = buildVisitsMessage({ today: 3, yesterday: 5, last7Days: 20, allTime: 40 });
    expect(message).toContain('Today: 3');
    expect(message).toContain('Last 7 days: 20');
    expect(message).toContain('Page loads, not unique people');
  });
});
