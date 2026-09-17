import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ChooseNicknameScreen } from './components/ChooseNicknameScreen';
import { LoginScreen } from './components/LoginScreen';
import { MenuDropdown } from './components/MenuDropdown';
import { PrivacyPolicyScreen } from './components/PrivacyPolicyScreen';
import { RoundFlow, type RoundResult, type RoundTiers } from './components/RoundFlow';
import { StartScreen } from './components/StartScreen';
import { getCountryById } from './data/countries';
import type { Country } from './data/types';
import { getDailyCountries, todayKey } from './lib/daily';
import { flagImageUrl } from './lib/flags';
import { tierIcon } from './lib/points';
import {
  clearDailyRecord,
  loadDailyRecord,
  loadStreak,
  saveDailyCompletion,
  type StoredDailyRecord,
  type StreakState,
} from './lib/storage';
import { supabase } from './lib/supabaseClient';

interface SummaryRow {
  countryId: string;
  countryName: string;
  stars: number;
  points: number;
  tiers?: RoundTiers;
}

// Spoiler-free by design: no country/capital names, just the per-round tier medals
// (country/capital/flag) and points (Wordle-style), so sharing doesn't give away any
// of the day's answers.
function buildShareText(
  dateKey: string,
  totalStars: number,
  totalRounds: number,
  totalPoints: number,
  streakDays: number,
  rows: SummaryRow[],
): string {
  const lines = [
    `MapsyQuest — ${dateKey}`,
    `⭐ ${totalStars}/${totalRounds * 3} · ${totalPoints} pts${streakDays > 0 ? ` · 🔥 ${streakDays}` : ''}`,
    '',
    ...rows.map((r) => `${tierIcon(r.tiers?.country)}${tierIcon(r.tiers?.capital)}${tierIcon(r.tiers?.flag)}`),
    '',
    'https://mapsyquest.vercel.app/',
  ];
  return lines.join('\n');
}

// DEV-ONLY, used by the Reset button below. To remove: delete this function, the
// handleReset function, the Reset button JSX, and switch playOrder/resetCount back
// to their plain useState (no setters) form.
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function App() {
  const [dateKey] = useState(() => todayKey());
  // The daily set is deterministic (same 7 countries for everyone, each date), but
  // the play ORDER reshuffles on Reset purely for replay/testing convenience.
  const [playOrder, setPlayOrder] = useState<Country[]>(() => getDailyCountries(dateKey));

  const [storedRecord, setStoredRecord] = useState<StoredDailyRecord | null>(() =>
    loadDailyRecord(dateKey),
  );
  const [streak, setStreak] = useState<StreakState>(() => loadStreak());
  const [roundIndex, setRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  // Bumped on reset so RoundFlow remounts even when round 1's country id is unchanged.
  const [resetCount, setResetCount] = useState(0);
  const [showCopiedNotice, setShowCopiedNotice] = useState(false);
  // Every visit lands on the start screen first — including a returning player who
  // already finished today, who sees the locked/countdown state there rather than
  // being dropped straight into their old results.
  const [screen, setScreen] = useState<'start' | 'game' | 'privacy' | 'login' | 'choose-nickname'>('start');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!showCopiedNotice) return;
    const timer = setTimeout(() => setShowCopiedNotice(false), 1800);
    return () => clearTimeout(timer);
  }, [showCopiedNotice]);

  // Google sign-in never goes through LoginScreen's own nickname field (it redirects
  // straight to Google), so this is how those players get offered one — once, the
  // first time, tracked via user_metadata.nicknamePrompted rather than re-asking on
  // every login.
  function maybePromptNickname(newSession: Session | null) {
    const metadata = newSession?.user.user_metadata;
    const isGoogleAccount = newSession?.user.app_metadata.provider === 'google';
    if (isGoogleAccount && !metadata?.nickname && !metadata?.nicknamePrompted) {
      setScreen('choose-nickname');
    }
  }

  // Picks up the session Supabase restores from storage on load, and the one it sets
  // after a Google OAuth redirect back into the app (both go through this callback).
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      maybePromptNickname(data.session);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      maybePromptNickname(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  function handleLogout() {
    supabase?.auth.signOut();
  }

  // Day-locked: today's game was already completed (possibly in an earlier
  // visit), so skip straight to the results already on record instead of
  // letting the player replay.
  const isGameOver = storedRecord !== null || roundIndex >= playOrder.length;

  function handleRoundComplete(result: RoundResult) {
    setResults((prev) => {
      const next = [...prev, result];
      if (next.length === playOrder.length) {
        const record: StoredDailyRecord = {
          date: dateKey,
          results: next.map((r) => ({
            countryId: r.country.id,
            countryName: r.country.name,
            stars: r.stars,
            points: r.points,
            tiers: r.tiers,
          })),
          totalStars: next.reduce((sum, r) => sum + r.stars, 0),
          totalPoints: next.reduce((sum, r) => sum + r.points, 0),
        };
        setStreak(saveDailyCompletion(record));
        setStoredRecord(record);
      }
      return next;
    });
    setRoundIndex((prev) => prev + 1);
  }

  /** DEV-ONLY: restarts the game, clearing today's progress and reshuffling the round order. */
  function handleReset() {
    clearDailyRecord(dateKey);
    setStoredRecord(null);
    setResults([]);
    setRoundIndex(0);
    setPlayOrder(shuffle(getDailyCountries(dateKey)));
    setResetCount((n) => n + 1);
  }

  async function handleShare() {
    const text = buildShareText(
      dateKey,
      totalStars,
      playOrder.length,
      totalPoints,
      streak.currentStreak,
      summaryRows,
    );
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setShowCopiedNotice(true);
  }

  const summaryRows: SummaryRow[] =
    storedRecord?.results ??
    results.map((r) => ({
      countryId: r.country.id,
      countryName: r.country.name,
      stars: r.stars,
      points: r.points,
      tiers: r.tiers,
    }));
  const totalStars = storedRecord?.totalStars ?? results.reduce((sum, r) => sum + r.stars, 0);
  const totalPoints = storedRecord?.totalPoints ?? results.reduce((sum, r) => sum + r.points, 0);

  // The nickname set at sign-up (see LoginScreen), falling back to whatever name Google
  // shared, then finally the email itself — so there's always something to show once
  // logged in, even for accounts created before nicknames existed.
  const displayName = session
    ? (session.user.user_metadata?.nickname as string | undefined) ||
      (session.user.user_metadata?.full_name as string | undefined) ||
      (session.user.user_metadata?.name as string | undefined) ||
      session.user.email ||
      'Account'
    : null;

  return (
    <div className="min-h-svh bg-slate-950 px-4 py-8 text-slate-100 md:py-4">
      {/* Same width/centering trick as MapScope's own wrapper (relative left-1/2 + w-[calc(100vw-2rem)]
          capped at max-w-2xl, translated back by half its width) so the Menu button's left edge lines
          up with the map's left border regardless of viewport size. */}
      <header className="relative left-1/2 z-20 mb-8 grid w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-start md:mb-3">
        <MenuDropdown
          onPrivacyPolicy={() => setScreen('privacy')}
          onLoginClick={() => setScreen('login')}
          onLogout={handleLogout}
          userEmail={session?.user.email ?? null}
        />
        <div className="min-w-0 text-center">
          <h1
            className="truncate text-lg font-bold tracking-wide text-emerald-400 [text-shadow:0_0_6px_rgba(15,23,42,0.9),0_0_10px_rgba(15,23,42,0.85),0_1px_2px_rgba(15,23,42,1)] sm:text-3xl md:text-3xl"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            MapsyQuest
          </h1>
          <p className="mt-1 truncate text-sm text-slate-400">Daily geography guessing game — {dateKey}</p>
        </div>
        {displayName && (
          <div
            title={displayName}
            className="min-w-0 max-w-full justify-self-end truncate rounded-xl bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-3 py-2 text-sm font-bold text-slate-950 shadow-lg sm:px-5 sm:py-2.5 sm:text-base"
          >
            {displayName}
          </div>
        )}
      </header>

      <main>
        {screen === 'privacy' && <PrivacyPolicyScreen onBack={() => setScreen('start')} />}

        {screen === 'login' && <LoginScreen onBack={() => setScreen('start')} />}

        {screen === 'choose-nickname' && session && (
          <ChooseNicknameScreen
            suggestedName={
              (session.user.user_metadata?.full_name as string | undefined) ||
              (session.user.user_metadata?.name as string | undefined) ||
              session.user.email ||
              'there'
            }
            onDone={() => setScreen('start')}
          />
        )}

        {screen === 'start' && (
          <StartScreen
            totalRounds={playOrder.length}
            isLocked={isGameOver}
            totalStars={totalStars}
            totalPoints={totalPoints}
            streak={streak}
            onPlay={() => setScreen('game')}
            onViewResults={() => setScreen('game')}
          />
        )}

        {screen === 'game' && !isGameOver && (
          <RoundFlow
            key={`${resetCount}-${playOrder[roundIndex].id}`}
            country={playOrder[roundIndex]}
            roundNumber={roundIndex + 1}
            totalRounds={playOrder.length}
            onRoundComplete={handleRoundComplete}
          />
        )}

        {screen === 'game' && isGameOver && (
          <div className="mx-auto w-full max-w-md space-y-6 text-center">
            <h2 className="text-2xl font-semibold">Today's results</h2>
            {streak.currentStreak > 0 && (
              <p className="text-sm text-amber-400">
                🔥 {streak.currentStreak} day streak (best {streak.maxStreak})
              </p>
            )}
            <p className="text-lg">
              {totalStars} / {playOrder.length * 3} stars &middot; {totalPoints} points
            </p>
            <ul className="grid grid-cols-[1.1rem_minmax(0,1fr)_minmax(0,1fr)_1.6rem_auto_auto] items-center gap-x-2 text-left text-xs text-slate-300">
              {summaryRows.map((r, i) => {
                const country = getCountryById(r.countryId);
                return (
                  <li key={r.countryId} className="contents">
                    <span className="border-b border-slate-800/70 py-1.5 text-slate-500">{i + 1}</span>
                    <span className="truncate border-b border-slate-800/70 py-1.5 font-medium text-slate-100">
                      {r.countryName}
                    </span>
                    <span className="truncate border-b border-slate-800/70 py-1.5 text-slate-400">
                      {country?.capital ?? '—'}
                    </span>
                    <span className="border-b border-slate-800/70 py-1.5">
                      {country && (
                        <img
                          src={flagImageUrl(country.id)}
                          alt=""
                          className="h-4 w-6 rounded-sm border border-slate-700 object-cover"
                        />
                      )}
                    </span>
                    <span className="whitespace-nowrap border-b border-slate-800/70 py-1.5 tracking-tight">
                      {tierIcon(r.tiers?.country)}
                      {tierIcon(r.tiers?.capital)}
                      {tierIcon(r.tiers?.flag)}
                    </span>
                    <span className="whitespace-nowrap border-b border-slate-800/70 py-1.5 text-right text-slate-300">
                      {r.points}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-slate-500">Come back tomorrow for a new set of countries.</p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleShare}
                className="rounded-lg border border-emerald-600 bg-emerald-600/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-600/20"
              >
                Share results
              </button>
              {/* DEV-ONLY: remove this button (and handleReset/shuffle above) to ship without a reset option. */}
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Reset
              </button>
            </div>
            {showCopiedNotice && (
              <p role="status" className="text-sm text-emerald-400">
                Results copied!
              </p>
            )}
            <button
              type="button"
              onClick={() => setScreen('start')}
              className="text-sm text-slate-400 underline hover:text-slate-200"
            >
              Return to main screen
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
