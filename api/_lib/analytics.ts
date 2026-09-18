import { timingSafeEqual } from 'node:crypto';

/** No fixed server timezone exists elsewhere in the app (each player's "today" is their
 * own local midnight — see src/lib/daily.ts) — Spain is used here as the operator's
 * reporting timezone. */
export const REPORT_TIMEZONE = 'Europe/Madrid';

const POSTHOG_APP_HOST = 'https://eu.posthog.com';

export interface CountsRow {
  players: number;
  gamesStarted: number;
  gamesCompleted: number;
  roundsCompleted: number;
}

export interface DurationRow {
  avgSeconds: number | null;
  medianSeconds: number | null;
}

export interface DateRange {
  /** Inclusive, YYYY-MM-DD, Europe/Madrid calendar date. */
  startDateKey: string;
  /** Inclusive, YYYY-MM-DD, Europe/Madrid calendar date. */
  endDateKey: string;
}

/** Constant-time, trim-tolerant string comparison — a plain `===` leaks timing info
 * byte-by-byte, and a secret pasted into the Vercel dashboard (or piped from a shell)
 * commonly picks up a trailing newline/space that would otherwise fail an exact match
 * despite the visible values being identical. */
export function safeCompare(a: string, b: string): boolean {
  const aTrimmed = a.trim();
  const bTrimmed = b.trim();
  if (!aTrimmed || !bTrimmed) return false;
  const aBuf = Buffer.from(aTrimmed);
  const bBuf = Buffer.from(bTrimmed);
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

function madridDateKey(date: Date): string {
  // en-CA renders as YYYY-MM-DD, which is exactly the HogQL date-literal format needed
  // below — no manual zero-padding/reassembly required.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Pure calendar-date arithmetic on a YYYY-MM-DD key, not a real timezone conversion —
 * shifting a date by N days doesn't depend on where in the day it currently is. */
function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayRange(): DateRange {
  const today = madridDateKey(new Date());
  return { startDateKey: today, endDateKey: today };
}

export function yesterdayRange(): DateRange {
  const yesterday = shiftDateKey(madridDateKey(new Date()), -1);
  return { startDateKey: yesterday, endDateKey: yesterday };
}

/** Rolling 7-calendar-day window: today plus the preceding 6 days. Today's slice only
 * covers activity up to the current moment, since today isn't over yet. */
export function last7DaysRange(): DateRange {
  const today = madridDateKey(new Date());
  return { startDateKey: shiftDateKey(today, -6), endDateKey: today };
}

function dateRangeFilter(range: DateRange): string {
  const bucket = `toDate(toTimeZone(timestamp, '${REPORT_TIMEZONE}'))`;
  return `${bucket} >= toDate('${range.startDateKey}') AND ${bucket} <= toDate('${range.endDateKey}')`;
}

/** Runs a HogQL query via PostHog's Query API and returns its first result row. Throws
 * on any non-2xx or malformed response — callers must not leak the raw error to clients,
 * since it can echo back the query and project details. `label` only identifies which
 * query failed in the log below; it carries no credentials. */
async function runHogQLQuery(query: string, label: string): Promise<unknown[]> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) {
    throw new Error('PostHog is not configured (missing POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID)');
  }

  const response = await fetch(`${POSTHOG_APP_HOST}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    // Without `refresh`, PostHog's Query API is free to serve a cached result instead of
    // calculating one live — force_blocking always (re)calculates and waits for the live
    // result. See git history on this file for how a stale cache previously produced a
    // wrong "games completed" count.
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query }, refresh: 'force_blocking' }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable response body>');
    console.error(`[analytics][posthog] "${label}" query rejected`, { status: response.status, body });
    throw new Error(`PostHog query failed with status ${response.status}`);
  }

  const data = (await response.json()) as { results?: unknown[][] };
  const row = data.results?.[0];
  if (!row) {
    throw new Error('PostHog query returned no rows');
  }
  return row;
}

export async function fetchCounts(range: DateRange): Promise<CountsRow> {
  const row = await runHogQLQuery(
    `
    SELECT
      uniqIf(distinct_id, event = 'game_started') AS players,
      countIf(event = 'game_started') AS games_started,
      countIf(event = 'game_completed') AS games_completed,
      countIf(event = 'round_completed') AS rounds_completed
    FROM events
    WHERE event IN ('game_started', 'game_completed', 'round_completed')
      AND ${dateRangeFilter(range)}
  `,
    'counts',
  );

  return {
    players: Number(row[0]),
    gamesStarted: Number(row[1]),
    gamesCompleted: Number(row[2]),
    roundsCompleted: Number(row[3]),
  };
}

export async function fetchDurationStats(range: DateRange): Promise<DurationRow> {
  const row = await runHogQLQuery(
    `
    SELECT
      avg(toFloat64OrNull(properties.seconds)) AS avg_seconds,
      quantile(0.5)(toFloat64OrNull(properties.seconds)) AS median_seconds
    FROM events
    WHERE event = 'game_duration'
      AND ${dateRangeFilter(range)}
  `,
    'duration',
  );

  return {
    avgSeconds: row[0] === null ? null : Number(row[0]),
    medianSeconds: row[1] === null ? null : Number(row[1]),
  };
}

export function formatDuration(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function buildReportMessage(title: string, counts: CountsRow, duration: DurationRow): string {
  const completionRate =
    counts.gamesStarted > 0 ? ((counts.gamesCompleted / counts.gamesStarted) * 100).toFixed(1) : null;

  const lines = [
    `MapsyQuest — ${title}`,
    '',
    `Players: ${counts.players}`,
    `Games started: ${counts.gamesStarted}`,
    `Rounds completed: ${counts.roundsCompleted}`,
    `Games completed: ${counts.gamesCompleted}`,
  ];
  if (completionRate !== null) {
    lines.push(`Completion rate: ${completionRate}%`);
  }
  if (duration.avgSeconds !== null) {
    lines.push(`Avg game duration: ${formatDuration(duration.avgSeconds)}`);
  }
  if (duration.medianSeconds !== null) {
    lines.push(`Median game duration: ${formatDuration(duration.medianSeconds)}`);
  }
  return lines.join('\n');
}

export async function generateReportMessage(title: string, range: DateRange): Promise<string> {
  const [counts, duration] = await Promise.all([fetchCounts(range), fetchDurationStats(range)]);
  return buildReportMessage(title, counts, duration);
}

/** Throws on failure — callers must not leak the raw error to clients, since Telegram's
 * response can echo back the bot token's associated chat/message details. */
export async function sendTelegramMessage(text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    throw new Error('Telegram is not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)');
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed with status ${response.status}`);
  }
}
