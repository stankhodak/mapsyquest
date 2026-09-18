import { timingSafeEqual } from 'node:crypto';

/** No fixed server timezone exists elsewhere in the app (each player's "today" is their
 * own local midnight — see src/lib/daily.ts) — Spain is picked here as the operator's
 * reporting timezone. */
const REPORT_TIMEZONE = 'Europe/Madrid';

const POSTHOG_APP_HOST = 'https://eu.posthog.com';

interface CountsRow {
  players: number;
  gamesStarted: number;
  gamesCompleted: number;
  roundsCompleted: number;
}

interface DurationRow {
  avgSeconds: number | null;
  medianSeconds: number | null;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}

/** Constant-time secret comparison — a plain `===` leaks timing info byte-by-byte. */
function isAuthorized(request: Request): boolean {
  const expected = process.env.ANALYTICS_REPORT_SECRET;
  if (!expected) return false;

  const header = request.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return false;

  const expectedBuf = Buffer.from(expected);
  const tokenBuf = Buffer.from(token);
  if (expectedBuf.length !== tokenBuf.length) return false;
  return timingSafeEqual(expectedBuf, tokenBuf);
}

/** Runs a HogQL query via PostHog's Query API and returns its first result row. Throws
 * on any non-2xx or malformed response — callers must not leak the raw error to clients,
 * since it can echo back the query and project details. */
async function runHogQLQuery(query: string): Promise<unknown[]> {
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
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });

  if (!response.ok) {
    throw new Error(`PostHog query failed with status ${response.status}`);
  }

  const data = (await response.json()) as { results?: unknown[][] };
  const row = data.results?.[0];
  if (!row) {
    throw new Error('PostHog query returned no rows');
  }
  return row;
}

async function fetchCounts(): Promise<CountsRow> {
  const row = await runHogQLQuery(`
    SELECT
      uniqIf(distinct_id, event = 'game_started') AS players,
      countIf(event = 'game_started') AS games_started,
      countIf(event = 'game_completed') AS games_completed,
      countIf(event = 'round_completed') AS rounds_completed
    FROM events
    WHERE event IN ('game_started', 'game_completed', 'round_completed')
      AND toDate(toTimezone(timestamp, '${REPORT_TIMEZONE}')) = toDate(toTimezone(now(), '${REPORT_TIMEZONE}'))
  `);

  return {
    players: Number(row[0]),
    gamesStarted: Number(row[1]),
    gamesCompleted: Number(row[2]),
    roundsCompleted: Number(row[3]),
  };
}

async function fetchDurationStats(): Promise<DurationRow> {
  const row = await runHogQLQuery(`
    SELECT
      avg(toFloat64OrNull(properties.seconds)) AS avg_seconds,
      quantile(0.5)(toFloat64OrNull(properties.seconds)) AS median_seconds
    FROM events
    WHERE event = 'game_duration'
      AND toDate(toTimezone(timestamp, '${REPORT_TIMEZONE}')) = toDate(toTimezone(now(), '${REPORT_TIMEZONE}'))
  `);

  return {
    avgSeconds: row[0] === null ? null : Number(row[0]),
    medianSeconds: row[1] === null ? null : Number(row[1]),
  };
}

function formatDuration(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function buildMessage(counts: CountsRow, duration: DurationRow): string {
  const completionRate =
    counts.gamesStarted > 0 ? ((counts.gamesCompleted / counts.gamesStarted) * 100).toFixed(1) : null;

  const lines = [
    'MapsyQuest — Today',
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

/** Throws on failure — callers must not leak the raw error to clients, since Telegram's
 * response can echo back the bot token's associated chat/message details. */
async function sendTelegramMessage(text: string): Promise<void> {
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

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!isAuthorized(request)) {
    return unauthorized();
  }

  try {
    const [counts, duration] = await Promise.all([fetchCounts(), fetchDurationStats()]);
    const message = buildMessage(counts, duration);
    await sendTelegramMessage(message);
    return new Response(JSON.stringify({ ok: true, message }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    // Logged server-side only — the client response stays generic so it can never
    // surface PostHog/Telegram credentials or account details from an error message.
    console.error('analytics-report failed:', error);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to generate or send the analytics report' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
