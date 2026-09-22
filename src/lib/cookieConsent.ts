/**
 * The player's choice on analytics cookies (PostHog is the only thing that sets one - see
 * posthogClient.ts). Saved locally, same try/catch caution as the rest of storage.ts, and
 * kept out of the per-account scoping there since it's a browser-level choice, not game data.
 */
import { safeGetItem, safeSetItem } from './storage';

const CONSENT_KEY = 'mapsyquest:cookie-consent';

export type CookieConsent = 'accepted' | 'rejected';

/** Null means no choice has been made yet - the banner should show. */
export function loadCookieConsent(): CookieConsent | null {
  const raw = safeGetItem(CONSENT_KEY);
  return raw === 'accepted' || raw === 'rejected' ? raw : null;
}

export function saveCookieConsent(choice: CookieConsent): void {
  safeSetItem(CONSENT_KEY, choice);
}
