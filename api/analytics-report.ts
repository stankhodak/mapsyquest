import type { IncomingMessage, ServerResponse } from 'node:http';
import { generateReportMessage, safeCompare, sendTelegramMessage, todayRange } from './_lib/analytics.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function isAuthorized(req: IncomingMessage): boolean {
  const expected = process.env.ANALYTICS_REPORT_SECRET;
  if (!expected) return false;

  const headerValue = req.headers.authorization;
  const header = Array.isArray(headerValue) ? headerValue[0] : (headerValue ?? '');
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return false;

  return safeCompare(token, expected);
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
    const message = await generateReportMessage('Today', todayRange());
    await sendTelegramMessage(message);
    sendJson(res, 200, { ok: true, message });
  } catch (error) {
    // Logged server-side only — the client response stays generic so it can never
    // surface PostHog/Telegram credentials or account details from an error message.
    console.error('analytics-report failed:', error);
    sendJson(res, 502, { ok: false, error: 'Failed to generate or send the analytics report' });
  }
}
