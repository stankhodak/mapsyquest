import { beforeEach, describe, expect, it } from 'vitest';
import { loadCookieConsent, saveCookieConsent } from '../cookieConsent';

beforeEach(() => window.localStorage.clear());

describe('cookieConsent', () => {
  it('is null until a choice is saved, so the banner shows', () => {
    expect(loadCookieConsent()).toBeNull();
  });

  it('round-trips an accepted choice', () => {
    saveCookieConsent('accepted');
    expect(loadCookieConsent()).toBe('accepted');
  });

  it('round-trips a rejected choice', () => {
    saveCookieConsent('rejected');
    expect(loadCookieConsent()).toBe('rejected');
  });

  it('treats garbage as no choice made', () => {
    window.localStorage.setItem('mapsyquest:cookie-consent', 'yes please');
    expect(loadCookieConsent()).toBeNull();
  });
});
