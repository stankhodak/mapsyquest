import { beforeEach, describe, expect, it } from 'vitest';
import { acceptAllPreferences, loadCookiePreferences, saveCookiePreferences } from '../cookieConsent';

beforeEach(() => window.localStorage.clear());

describe('cookieConsent', () => {
  it('is null until a choice is saved, so the banner shows', () => {
    expect(loadCookiePreferences()).toBeNull();
  });

  it('round-trips saved preferences', () => {
    saveCookiePreferences({ analytics: true, advertising: false });
    expect(loadCookiePreferences()).toEqual({ analytics: true, advertising: false });
  });

  it('treats garbage as no choice made', () => {
    window.localStorage.setItem('mapsyquest:cookie-consent', 'not json');
    expect(loadCookiePreferences()).toBeNull();
  });

  it('fills in a category missing from an older save as off', () => {
    window.localStorage.setItem('mapsyquest:cookie-consent', JSON.stringify({ analytics: true }));
    expect(loadCookiePreferences()).toEqual({ analytics: true, advertising: false });
  });

  it('accepting all only turns on categories actually in use', () => {
    // Advertising isn't wired to anything yet, so "accept all" can't turn it on.
    expect(acceptAllPreferences()).toEqual({ analytics: true, advertising: false });
  });
});
