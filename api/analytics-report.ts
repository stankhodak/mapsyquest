import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

/** Constant-time secret comparison — a plain `===` leaks timing info byte-by-byte. */
function isAuthorized(req: IncomingMessage): boolean {
  const expected = process.env.ANALYTICS_REPORT_SECRET;

  const headerValue = req.headers.authorization;
  const header = Array.isArray(headerValue) ? headerValue[0] : (headerValue ?? '');
  const [scheme, rawToken] = header.split(' ');
  // Trimmed defensively: a secret pasted into the Vercel dashboard (or a value piped
  // from a shell) commonly picks up a trailing newline/space, which would otherwise
  // fail the length check below despite the visible value being identical.
  const token = (rawToken ?? '').trim();
  const expectedTrimmed = (expected ?? '').trim();

  let valuesMatch = false;
  if (expectedTrimmed && scheme === 'Bearer' && token) {
    const expectedBuf = Buffer.from(expectedTrimmed);
    const tokenBuf = Buffer.from(token);
    valuesMatch = expectedBuf.length === tokenBuf.length && timingSafeEqual(expectedBuf, tokenBuf);
  }

  // TEMPORARY DIAGNOSTIC LOGGING — remove once the auth mismatch is confirmed fixed.
  // Reports only booleans/lengths; never logs the header value or the secret itself.
  console.log('[analytics-report][diag]', {
    authHeaderReceived: header.length > 0,
    envSecretExists: Boolean(expected),
    authHeaderLength: header.length,
    envSecretLength: expected?.length ?? 0,
    valuesMatch,
  });

  return Boolean(expectedTrimmed) && valuesMatch;
}

/** Runs a HogQL query via PostHog's Query API and returns its first result row. Throws
 * on any non-2xx or malformed response — callers must not leak the raw error to clients,
 * since it can echo back the query and project details. `label` only identifies which
 * query failed in the diagnostic log below; it carries no credentials. */
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
    // calculating one live. Both HogQL queries here compute "today" via now() rather than
    // a value bound from this request, so their query text is identical on every call —
    // exactly what PostHog's cache keys on — making a stale cache hit likely rather than
    // hypothetical. force_blocking always (re)calculates and waits for the live result.
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query }, refresh: 'force_blocking' }),
  });

  if (!response.ok) {
    // TEMPORARY DIAGNOSTIC LOGGING — remove once the 400 is root-caused. Logs PostHog's
    // own validation error body so we can see exactly what it rejected. Never logs the
    // API key, the Authorization header, or any other credential.
    const body = await response.text().catch(() => '<unreadable response body>');
    console.error(`[analytics-report][posthog] "${label}" query rejected`, {
      status: response.status,
      body,
    });
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
  const row = await runHogQLQuery(
    `
    SELECT
      uniqIf(distinct_id, event = 'game_started') AS players,
      countIf(event = 'game_started') AS games_started,
      countIf(event = 'game_completed') AS games_completed,
      countIf(event = 'round_completed') AS rounds_completed
    FROM events
    WHERE event IN ('game_started', 'game_completed', 'round_completed')
      AND toDate(toTimeZone(timestamp, '${REPORT_TIMEZONE}')) = toDate(toTimeZone(now(), '${REPORT_TIMEZONE}'))
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

async function fetchDurationStats(): Promise<DurationRow> {
  const row = await runHogQLQuery(
    `
    SELECT
      avg(toFloat64OrNull(properties.seconds)) AS avg_seconds,
      quantile(0.5)(toFloat64OrNull(properties.seconds)) AS median_seconds
    FROM events
    WHERE event = 'game_duration'
      AND toDate(toTimeZone(timestamp, '${REPORT_TIMEZONE}')) = toDate(toTimeZone(now(), '${REPORT_TIMEZONE}'))
  `,
    'duration',
  );

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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    return;
  }

  try {
    const [counts, duration] = await Promise.all([fetchCounts(), fetchDurationStats()]);
    const message = buildMessage(counts, duration);
    await sendTelegramMessage(message);
    sendJson(res, 200, { ok: true, message });
  } catch (error) {
    // Logged server-side only — the client response stays generic so it can never
    // surface PostHog/Telegram credentials or account details from an error message.
    console.error('analytics-report failed:', error);
    sendJson(res, 502, { ok: false, error: 'Failed to generate or send the analytics report' });
  }
}
