import posthog from 'posthog-js';

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;

/** False until VITE_POSTHOG_KEY is set — callers should skip capture() calls rather
 * than invoking an uninitialized client. */
export const isPostHogConfigured = Boolean(posthogKey);

if (isPostHogConfigured) {
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
}

export { posthog };
