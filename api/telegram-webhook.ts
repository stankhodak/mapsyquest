import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  generateReportMessage,
  last7DaysRange,
  safeCompare,
  sendTelegramMessage,
  todayRange,
  yesterdayRange,
} from './_lib/analytics.js';

/** Vercel's Node.js runtime auto-parses a JSON request body into `req.body` even for a
 * plain (req, res) handler like this one — no @vercel/node dependency needed for it. */
interface VercelLikeRequest extends IncomingMessage {
  body?: unknown;
}

interface TelegramUpdate {
  message?: {
    text?: string;
    chat: { id: number | string };
  };
}

const HELP_TEXT = [
  'MapsyQuest Analytics',
  '',
  "/today — today's activity",
  '/yesterday — yesterday\'s activity',
  '/week — last 7 days',
  '/help — commands',
].join('\n');

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function isValidSecretToken(req: IncomingMessage): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;

  const headerValue = req.headers['x-telegram-bot-api-secret-token'];
  const header = Array.isArray(headerValue) ? headerValue[0] : (headerValue ?? '');
  return safeCompare(header, expected);
}

function parseUpdate(req: VercelLikeRequest): TelegramUpdate | undefined {
  const body = req.body;
  if (!body) return undefined;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as TelegramUpdate;
    } catch {
      return undefined;
    }
  }
  return body as TelegramUpdate;
}

/** Strips a "@botname" suffix (present when a bot is addressed by name, e.g. in a group
 * chat) and lowercases, so "/Today@MapsyQuestBot" matches the same as "/today". */
function parseCommand(text: string): string {
  const firstWord = text.trim().split(/\s+/)[0] ?? '';
  return firstWord.split('@')[0].toLowerCase();
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false });
    return;
  }

  if (!isValidSecretToken(req)) {
    sendJson(res, 401, { ok: false });
    return;
  }

  const update = parseUpdate(req);
  const message = update?.message;
  const expectedChatId = process.env.TELEGRAM_CHAT_ID;

  // Not a command from the configured chat (wrong chat, no text, or a non-message
  // update like an edited_message/channel_post) — acknowledge and do nothing, so
  // Telegram doesn't retry redelivering it.
  if (!message?.text || !expectedChatId || String(message.chat.id) !== expectedChatId) {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (!message.text.startsWith('/')) {
    sendJson(res, 200, { ok: true });
    return;
  }

  const command = parseCommand(message.text);

  try {
    if (command === '/today') {
      await sendTelegramMessage(await generateReportMessage('Today', todayRange()));
    } else if (command === '/yesterday') {
      await sendTelegramMessage(await generateReportMessage('Yesterday', yesterdayRange()));
    } else if (command === '/week') {
      await sendTelegramMessage(await generateReportMessage('Last 7 days', last7DaysRange()));
    } else {
      // '/help' and any unrecognized command both get the same help text.
      await sendTelegramMessage(HELP_TEXT);
    }
    sendJson(res, 200, { ok: true });
  } catch (error) {
    // Logged server-side only — never surfaces PostHog/Telegram credentials.
    console.error('telegram-webhook command failed:', error);
    await sendTelegramMessage('Sorry, something went wrong generating that report.').catch(() => {});
    // Still 200 — the update WAS handled (it failed, but retrying won't help and would
    // just resend the same failure notice to the chat).
    sendJson(res, 200, { ok: true });
  }
}
