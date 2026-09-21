import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import {
  trackGameAbandoned,
  trackGameCompleted,
  trackGameDuration,
  trackGameStarted,
  trackRoundCompleted,
} from './lib/analytics';
import { AccountBadge } from './components/AccountBadge';
import { AchievementsPanel } from './components/AchievementsPanel';
import { ChooseNicknameScreen } from './components/ChooseNicknameScreen';
import { FeedbackScreen } from './components/FeedbackScreen';
import { LeaderboardOffer, type LeaderboardAccount } from './components/LeaderboardOffer';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { LoginScreen } from './components/LoginScreen';
import { MenuDropdown } from './components/MenuDropdown';
import { PrivacyPolicyScreen } from './components/PrivacyPolicyScreen';
import { RoundFlow, type RoundResult, type RoundTiers } from './components/RoundFlow';
import { ScoringGuideScreen } from './components/ScoringGuideScreen';
import { ChallengesHub } from './components/ChallengesHub';
import { StartScreen } from './components/StartScreen';
import { getCountryById } from './data/countries';
import type { Country } from './data/types';
import { recordGame } from './lib/achievementStore';
import type { EarnedAchievement } from './lib/achievements';
import { getDailyCountries, todayKey } from './lib/daily';
import { flagImageUrl } from './lib/flags';
import type { ChallengeSetup } from './lib/challenges';
import {
  challengeForBoard,
  clearPendingEntry,
  entryFromDailyRecord,
  loadPendingEntry,
  suggestedNickname,
  type BoardEntry,
} from './lib/leaderboard';
import { buildGameSummary, fullRoundSummary } from './lib/gameSummaries';
import { recordCompletedGame } from './lib/playerStats';
import { tierIcon } from './lib/points';
import {
  // clearDailyRecord, // only used by the disabled Reset button — restore alongside it
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
  siteUrl: string,
): string {
  const lines = [
    `MapsyQuest — ${dateKey}`,
    `⭐ ${totalStars}/${totalRounds * 3} · ${totalPoints} pts${streakDays > 0 ? ` · 🔥 ${streakDays}` : ''}`,
    '',
    ...rows.map((r) => `${tierIcon(r.tiers?.country)}${tierIcon(r.tiers?.capital)}${tierIcon(r.tiers?.flag)}`),
    '',
    siteUrl,
  ];
  return lines.join('\n');
}

// Reset hidden for now — uncomment this function and the button below to restore it.
// function shuffle<T>(items: T[]): T[] {
//   const copy = [...items];
//   for (let i = copy.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [copy[i], copy[j]] = [copy[j], copy[i]];
//   }
//   return copy;
// }

function App() {
  const [dateKey] = useState(() => todayKey());
  // The daily set is deterministic (same 7 countries for everyone, each date), but
  // the play ORDER reshuffles on Reset purely for replay/testing convenience.
  // Setter is `_`-prefixed (TS noUnusedLocals exempts underscore-prefixed names) since
  // its only caller, handleReset, is commented out below. Restoring Reset needs BOTH:
  // rename `_setPlayOrder` -> `setPlayOrder` here AND uncomment handleReset (which
  // already calls it as `setPlayOrder`).
  const [playOrder, _setPlayOrder] = useState<Country[]>(() => getDailyCountries(dateKey));

  const [storedRecord, setStoredRecord] = useState<StoredDailyRecord | null>(() =>
    loadDailyRecord(dateKey),
  );
  const [streak, setStreak] = useState<StreakState>(() => loadStreak());
  const [roundIndex, setRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  // Bumped on reset so RoundFlow remounts even when round 1's country id is unchanged.
  // Setter is `_`-prefixed for the same reason as _setPlayOrder above — restore both
  // together (rename `_setResetCount` -> `setResetCount` here, uncomment handleReset).
  const [resetCount, _setResetCount] = useState(0);
  const [showCopiedNotice, setShowCopiedNotice] = useState(false);
  // Achievements the daily game just earned. Only set in the session that finishes the
  // game — a returning player viewing an old result doesn't re-earn (or re-record) them.
  const [dailyEarned, setDailyEarned] = useState<EarnedAchievement[]>([]);
  // Which board the leaderboard screen opens on.
  const [leaderboardBoard, setLeaderboardBoard] = useState('daily');
  // Every visit lands on the start screen first — including a returning player who
  // already finished today, who sees the locked/countdown state there rather than
  // being dropped straight into their old results.
  const [screen, setScreen] = useState<
    | 'start'
    | 'game'
    | 'privacy'
    | 'login'
    | 'choose-nickname'
    | 'feedback'
    | 'more-challenges'
    | 'scoring'
    | 'leaderboard'
    | 'post-pending'
  >('start');
  const [session, setSession] = useState<Session | null>(null);
  // The score a guest was offered before logging in, shown again once they're signed in.
  const [pendingEntry, setPendingEntry] = useState<BoardEntry | null>(null);
  // A game the challenges screen should start as soon as it opens (from a leaderboard's "Take It!").
  const [challengeToStart, setChallengeToStart] = useState<ChallengeSetup | null>(null);
  // Set when the player presses Play (or dev-Resets); null once the round data itself
  // (results/roundIndex) has been cleared without a fresh play, so the game_abandoned
  // check below can tell "actively mid-game" apart from "sitting on the start screen".
  const [gameStartedAt, setGameStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!showCopiedNotice) return;
    const timer = setTimeout(() => setShowCopiedNotice(false), 1800);
    return () => clearTimeout(timer);
  }, [showCopiedNotice]);

  // Reports a game_abandoned event if the tab closes/navigates away while a round is
  // in progress. pagehide (not beforeunload) so it still fires on mobile Safari and
  // doesn't block the page from entering the back/forward cache.
  useEffect(() => {
    function handlePageHide() {
      if (gameStartedAt !== null && roundIndex < playOrder.length) {
        trackGameAbandoned(roundIndex + 1);
      }
    }
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [gameStartedAt, roundIndex, playOrder.length]);

  // Shows the score a guest was offered before logging in, now that they're signed in.
  // Cleared as it's shown, so it's offered once and never nags on later visits.
  function offerPendingEntry(): boolean {
    const pending = loadPendingEntry(todayKey());
    if (!pending) return false;
    clearPendingEntry();
    setPendingEntry(pending);
    setScreen('post-pending');
    return true;
  }

  function finishLogin() {
    if (!offerPendingEntry()) setScreen('start');
  }

  // Google sign-in never goes through LoginScreen's own nickname field (it redirects
  // straight to Google), so this is how those players get offered one — once, the
  // first time, tracked via user_metadata.nicknamePrompted rather than re-asking on
  // every login.
  function maybePromptNickname(newSession: Session | null): boolean {
    const metadata = newSession?.user.user_metadata;
    const isGoogleAccount = newSession?.user.app_metadata.provider === 'google';
    if (isGoogleAccount && !metadata?.nickname && !metadata?.nicknamePrompted) {
      setScreen('choose-nickname');
      return true;
    }
    return false;
  }

  // Picks up the session Supabase restores from storage on load, and the one it sets
  // after a Google OAuth redirect back into the app (both go through this callback).
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      // A player arriving from a Google redirect or a confirmation email, having logged in to post a score.
      if (data.session && !maybePromptNickname(data.session)) offerPendingEntry();
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

  function handlePlay() {
    trackGameStarted();
    setGameStartedAt(Date.now());
    setScreen('game');
  }

  function handleRoundComplete(result: RoundResult) {
    trackRoundCompleted(roundIndex + 1, result.stars, result.points);
    // Built from `results` directly (not a setResults functional updater) specifically
    // so the trackGameCompleted/trackGameDuration calls below run exactly once — a side
    // effect inside a state updater gets double-invoked by StrictMode in dev (and isn't
    // guaranteed once in general), which was firing these analytics events twice.
    const next = [...results, result];
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
      const newStreak = saveDailyCompletion(record);
      setStreak(newStreak);
      setStoredRecord(record);
      setDailyEarned(
        recordGame(buildGameSummary({ kind: 'daily', rounds: next.map(fullRoundSummary) }), newStreak.currentStreak)
          .earned,
      );
      trackGameCompleted(record.totalStars, record.totalPoints, playOrder.length);
      if (gameStartedAt !== null) {
        trackGameDuration(Math.round((Date.now() - gameStartedAt) / 1000));
      }
      if (session) {
        recordCompletedGame(session.user.id, record.totalStars, record.totalPoints, newStreak);
      }
    }
    setResults(next);
    setRoundIndex((prev) => prev + 1);
  }

  // Reset hidden for now — uncomment this function and the button below to restore it.
  // /** Restarts the game: clears today's progress and reshuffles the round order. */
  // function handleReset() {
  //   clearDailyRecord(dateKey);
  //   setStoredRecord(null);
  //   setResults([]);
  //   setRoundIndex(0);
  //   setPlayOrder(shuffle(getDailyCountries(dateKey)));
  //   setResetCount((n) => n + 1);
  //   setGameStartedAt(Date.now());
  // }

  async function handleShare() {
    const text = buildShareText(
      dateKey,
      totalStars,
      playOrder.length,
      totalPoints,
      streak.currentStreak,
      summaryRows,
      `${window.location.origin}/`,
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
  // Built from the saved day record (not just this session's game) so a guest who logs in
  // after finishing - which reloads the page - can still post today's score.
  const dailyEntry = storedRecord
    ? entryFromDailyRecord(
        storedRecord,
        dailyEarned.map((a) => a.id),
      )
    : null;
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

  function openChallengesHub(setup: ChallengeSetup | null = null) {
    setChallengeToStart(setup);
    setScreen('more-challenges');
  }

  function takeBoardChallenge(board: string) {
    const setup = challengeForBoard(board);
    if (setup) openChallengesHub(setup);
    else if (!isGameOver) handlePlay();
  }

  function openLeaderboard(board: string) {
    setLeaderboardBoard(board);
    setScreen('leaderboard');
  }

  const account: LeaderboardAccount | null = session
    ? { userId: session.user.id, suggestedNickname: suggestedNickname(session.user.user_metadata) }
    : null;

  return (
    <div className="min-h-svh bg-slate-950 px-4 py-8 text-slate-100 md:py-4">
      {/* Same width/centering trick as MapScope's own wrapper (relative left-1/2 + w-[calc(100vw-2rem)]
          capped at max-w-2xl, translated back by half its width) so the Menu button's left edge lines
          up with the map's left border regardless of viewport size. */}
      <header className="relative left-1/2 z-20 mb-8 grid w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-start md:mb-3">
        <MenuDropdown
          onPrivacyPolicy={() => setScreen('privacy')}
          onScoringGuide={() => setScreen('scoring')}
          onLeaderboards={() => openLeaderboard('daily')}
          onLoginClick={() => setScreen('login')}
          onLogout={handleLogout}
          userEmail={session?.user.email ?? null}
        />
        <div className="min-w-0 text-center">
          <h1
            className="truncate bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 bg-clip-text text-lg font-bold tracking-wide text-transparent sm:text-3xl md:text-3xl"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            MapsyQuest
          </h1>
        </div>
        {displayName && session && <AccountBadge displayName={displayName} userId={session.user.id} />}
      </header>

      <main>
        {screen === 'privacy' && <PrivacyPolicyScreen onBack={() => setScreen('start')} />}

        {screen === 'scoring' && <ScoringGuideScreen onBack={() => setScreen('start')} />}

        {screen === 'feedback' && (
          <FeedbackScreen
            onBack={() => setScreen('start')}
            userEmail={session?.user.email ?? null}
            userId={session?.user.id ?? null}
          />
        )}

        {screen === 'login' && <LoginScreen onBack={() => setScreen('start')} onLoggedIn={finishLogin} />}

        {screen === 'choose-nickname' && session && (
          <ChooseNicknameScreen
            suggestedName={
              (session.user.user_metadata?.full_name as string | undefined) ||
              (session.user.user_metadata?.name as string | undefined) ||
              session.user.email ||
              'there'
            }
            onDone={finishLogin}
          />
        )}

        {screen === 'start' && (
          <StartScreen
            totalRounds={playOrder.length}
            isLocked={isGameOver}
            totalStars={totalStars}
            totalPoints={totalPoints}
            streak={streak}
            onPlay={handlePlay}
            onViewResults={() => setScreen('game')}
            onMoreChallenges={() => openChallengesHub()}
          />
        )}

        {screen === 'more-challenges' && (
          <ChallengesHub
            onBack={() => setScreen('start')}
            account={account}
            onLogin={() => setScreen('login')}
            onViewBoard={openLeaderboard}
            initialSetup={challengeToStart}
          />
        )}

        {screen === 'post-pending' && pendingEntry && (
          <div className="mx-auto w-full max-w-md space-y-4 text-center">
            <h2 className="text-xl font-bold text-slate-100">You're logged in</h2>
            <p className="text-sm text-slate-400">Here's the score you finished before logging in.</p>
            <LeaderboardOffer
              entry={pendingEntry}
              account={account}
              onLogin={() => setScreen('login')}
              onViewBoard={openLeaderboard}
            />
            <button
              type="button"
              onClick={() => setScreen('start')}
              className="text-sm text-slate-400 underline hover:text-slate-200"
            >
              Return to main screen
            </button>
          </div>
        )}

        {screen === 'leaderboard' && (
          <LeaderboardScreen
            initialBoard={leaderboardBoard}
            userId={account?.userId ?? null}
            dailyDone={isGameOver}
            onTakeIt={takeBoardChallenge}
            onBack={() => setScreen('start')}
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
            <AchievementsPanel earned={dailyEarned} />
            <LeaderboardOffer
              entry={dailyEntry}
              account={account}
              onLogin={() => setScreen('login')}
              onViewBoard={openLeaderboard}
            />
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
              {/* Reset hidden for now — uncomment to restore it.
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Reset
              </button>
              */}
            </div>
            {showCopiedNotice && (
              <p role="status" className="text-sm text-emerald-400">
                Results copied!
              </p>
            )}
            <button
              type="button"
              onClick={() => setScreen('start')}
              className="block text-base font-bold text-emerald-400 underline hover:text-emerald-300"
            >
              Return to main screen
            </button>
            <button
              type="button"
              onClick={() => setScreen('feedback')}
              className="block text-sm text-slate-400 underline hover:text-slate-200"
            >
              Feedback welcome
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
