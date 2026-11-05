import { supabase } from './supabaseClient';

/**
 * Adds one to today's anonymous visit counter (supabase/site_hits.sql). Runs for every
 * visitor regardless of cookie consent, because it stores nothing in the browser and
 * nothing about the visitor on the server: just a per-day number. Fire-and-forget, so a
 * missing table or a network error never affects the game.
 */
export function recordSiteHit(): void {
  if (!supabase) return;
  supabase.rpc('mapsyquest_record_hit').then(
    () => {},
    () => {},
  );
}
