/**
 * The player's choice on optional cookies, by category — the classic Necessary /
 * Analytics / Advertising split, so a future category (e.g. ads) slots in here without
 * reshaping the consent UI again. Saved locally, same try/catch caution as the rest of
 * storage.ts, and kept out of the per-account scoping there since it's a browser-level
 * choice, not game data.
 */
import { safeGetItem, safeSetItem } from './storage';

export type CookieCategoryId = 'analytics' | 'advertising';

export interface CookieCategory {
  id: CookieCategoryId;
  label: string;
  description: string;
  /** False for a category nothing in the app uses yet (currently advertising) — listed
   * for transparency, but its toggle stays off and disabled until that changes. */
  inUse: boolean;
}

/** MapsyQuest sets no strictly-necessary cookies today either — login and local game data
 * both live in browser storage, not cookies — but the row is kept in the classic layout
 * players expect, described as such rather than omitted. */
export const COOKIE_CATEGORIES: CookieCategory[] = [
  {
    id: 'analytics',
    label: 'Analytics',
    description:
      "Lets us see how MapsyQuest is used — which features get played, where people drop off — so we can improve the game. Used only for our own product analytics, never shared with advertisers.",
    inUse: true,
  },
  {
    id: 'advertising',
    label: 'Advertising',
    description: "MapsyQuest doesn't show ads or use advertising cookies. Listed here in case that ever changes.",
    inUse: false,
  },
];

export type CookiePreferences = Record<CookieCategoryId, boolean>;

const CONSENT_KEY = 'mapsyquest:cookie-consent';

/** Every category off — the "Necessary only" / "Reject all" choice. */
export function rejectAllPreferences(): CookiePreferences {
  return Object.fromEntries(COOKIE_CATEGORIES.map((c) => [c.id, false])) as CookiePreferences;
}

/** Every category currently in use, switched on; anything not in use stays off regardless. */
export function acceptAllPreferences(): CookiePreferences {
  return Object.fromEntries(COOKIE_CATEGORIES.map((c) => [c.id, c.inUse])) as CookiePreferences;
}

/** Null means no choice has been made yet — the banner should show. */
export function loadCookiePreferences(): CookiePreferences | null {
  const raw = safeGetItem(CONSENT_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Partial<Record<string, unknown>>;
    const prefs = rejectAllPreferences();
    for (const category of COOKIE_CATEGORIES) {
      if (typeof saved[category.id] === 'boolean') prefs[category.id] = saved[category.id] as boolean;
    }
    return prefs;
  } catch {
    return null;
  }
}

export function saveCookiePreferences(prefs: CookiePreferences): void {
  safeSetItem(CONSENT_KEY, JSON.stringify(prefs));
}
