import posthog from 'posthog-js';
import { loadCookiePreferences } from './cookieConsent';

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;

/** False until VITE_POSTHOG_KEY is set — callers should skip capture() calls rather
 * than invoking an uninitialized client. */
export const isPostHogConfigured = Boolean(posthogKey);

// posthog.init() only actually sets up the SDK (and its cookie) the first time it's called
// — a later call is a no-op — so re-enabling after a reject has to go through
// opt_in_capturing() instead. loaded tracks whether init() has run at all; initialized
// tracks whether it's currently allowed to capture.
let loaded = false;
let initialized = false;

/** True once PostHog is actually capturing — configured AND the player has consented. */
export function isPostHogTracking(): boolean {
  return initialized;
}

function init(): void {
  if (!isPostHogConfigured || loaded) return;
  posthog.init(posthogKey, {
    api_host: 'https://eu.i.posthog.com',
    // Pins the SDK default-behavior set to what the project's own setup snippet
    // recommends, rather than silently drifting as PostHog ships new defaults.
    defaults: '2026-05-30',
    // Avoids creating a full person profile for every anonymous visitor — we don't
    // currently call posthog.identify() (no tie-in to Supabase accounts), so there's
    // no "identified" user to merge profiles for anyway.
    person_profiles: 'identified_only',
  });
  loaded = true;
  initialized = true;
}

// PostHog's default persistence is 'localStorage+cookie', so initializing it is what sets
// a cookie in the player's browser — this only runs if the analytics category was already
// on from an earlier visit. First-time (and undecided) visitors get no cookie until the
// consent banner or the Privacy Policy's Cookies section calls enablePostHogTracking below.
if (loadCookiePreferences()?.analytics) init();

/** Starts capturing — called when the player turns the analytics category on. */
export function enablePostHogTracking(): void {
  if (!isPostHogConfigured) return;
  if (loaded) posthog.opt_in_capturing();
  else init();
  initialized = true;
}

/** Stops capturing and clears whatever PostHog already stored (the cookie included) —
 * called when the player turns the analytics category off, having earlier turned it on. Note:
 * opt_out_capturing() alone stops tracking but rewrites the cookie with a fresh (opted-out)
 * state rather than removing it — persistence.clear() is what actually deletes it. */
export function disablePostHogTracking(): void {
  if (!initialized) return;
  posthog.opt_out_capturing();
  posthog.persistence?.clear();
  initialized = false;
}

export { posthog };
