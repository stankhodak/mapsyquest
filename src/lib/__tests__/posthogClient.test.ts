import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Runs the real posthog-js SDK (no mock) against jsdom; only the network is stubbed out so
// nothing is sent anywhere. posthogClient reads its key and the saved consent at import, so
// each test imports a fresh copy after setting those up.
const KEY = 'phc_test_key';
const CONSENT_KEY = 'mapsyquest:cookie-consent';
const OPT_OUT_KEY = `__ph_opt_in_out_${KEY}`;

async function loadClient() {
  vi.resetModules();
  return import('../posthogClient');
}

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('VITE_POSTHOG_KEY', KEY);
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('posthogClient consent', () => {
  it('does not start PostHog before the player has chosen', async () => {
    const client = await loadClient();
    expect(client.isPostHogTracking()).toBe(false);
  });

  it('starts capturing on a later visit when analytics was accepted earlier', async () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: true, advertising: false }));
    const client = await loadClient();
    expect(client.isPostHogTracking()).toBe(true);
    expect(client.posthog.has_opted_out_capturing()).toBe(false);
  });

  it("clears PostHog's leftover opt-out when analytics is accepted again on a later visit", async () => {
    // A previous visit accepted, then rejected: PostHog's own opt-out flag outlives the reject.
    localStorage.setItem(OPT_OUT_KEY, '0');
    const client = await loadClient();
    expect(client.isPostHogTracking()).toBe(false);

    client.enablePostHogTracking();
    expect(client.isPostHogTracking()).toBe(true);
    expect(client.posthog.has_opted_out_capturing()).toBe(false);
  });

  it('stops capturing when analytics is turned off', async () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: true, advertising: false }));
    const client = await loadClient();
    client.disablePostHogTracking();
    expect(client.isPostHogTracking()).toBe(false);
    expect(client.posthog.has_opted_out_capturing()).toBe(true);
  });
});
