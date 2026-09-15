import { useEffect, useState } from 'react';
import { RoundFlow, type RoundResult, type RoundTiers } from './components/RoundFlow';
import { StartScreen } from './components/StartScreen';
import { getCountryById } from './data/countries';
import type { Country } from './data/types';
import { getDailyCountries, todayKey } from './lib/daily';
import { flagImageUrl } from './lib/flags';
import { tierEmoji, tierIcon } from './lib/points';
import {
  // clearDailyRecord, // only used by the disabled Reset button — restore alongside it
  loadDailyRecord,
  loadStreak,
  saveDailyCompletion,
  type StoredDailyRecord,
  type StreakState,
} from './lib/storage';

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
    ...rows.map((r) => `${tierEmoji(r.tiers?.country)}${tierEmoji(r.tiers?.capital)}${tierEmoji(r.tiers?.flag)}`),
    '',
    'https://mapsyquest.vercel.app/',
  ];
  return lines.join('\n');
}

// Only used by the disabled Reset button — restore alongside it.
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
  // Every visit lands on the start screen first — including a returning player who
  // already finished today, who sees the locked/countdown state there rather than
  // being dropped straight into their old results.
  const [screen, setScreen] = useState<'start' | 'game'>('start');

  useEffect(() => {
    if (!showCopiedNotice) return;
    const timer = setTimeout(() => setShowCopiedNotice(false), 1800);
    return () => clearTimeout(timer);
  }, [showCopiedNotice]);

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

  // Reset removed for now — uncomment this function and the button below to restore it.
  // /** Restarts the game: clears today's progress and reshuffles the round order. */
  // function handleReset() {
  //   clearDailyRecord(dateKey);
  //   setStoredRecord(null);
  //   setResults([]);
  //   setRoundIndex(0);
  //   setPlayOrder(shuffle(getDailyCountries(dateKey)));
  //   setResetCount((n) => n + 1);
  // }

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

  return (
    <div className="min-h-svh bg-slate-950 px-4 py-8 text-slate-100 md:py-4">
      <header className="mx-auto mb-8 max-w-md text-center md:mb-3">
        <h1
          className="text-4xl font-bold tracking-wide text-emerald-400 [text-shadow:0_0_6px_rgba(15,23,42,0.9),0_0_10px_rgba(15,23,42,0.85),0_1px_2px_rgba(15,23,42,1)] md:text-3xl"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          MapsyQuest
        </h1>
        <p className="text-sm text-slate-400">Daily geography guessing game — {dateKey}</p>
      </header>

      <main>
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
            <ul className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-1 text-left text-sm text-slate-300">
              {summaryRows.map((r) => {
                const country = getCountryById(r.countryId);
                return (
                  <li key={r.countryId} className="contents">
                    <span className="pt-3 leading-snug font-medium text-slate-100">{r.countryName}</span>
                    <span className="pt-3 text-right">{tierIcon(r.tiers?.country)}</span>
                    <span className="pt-3 text-right">{r.points} pts</span>

                    <span className="leading-snug text-slate-400">{country?.capital ?? '—'}</span>
                    <span className="text-right">{tierIcon(r.tiers?.capital)}</span>
                    <span />

                    <span className="pb-3">
                      {country && (
                        <img
                          src={flagImageUrl(country.id)}
                          alt=""
                          className="h-6 w-9 rounded-sm border border-slate-700 object-cover"
                        />
                      )}
                    </span>
                    <span className="pb-3 text-right">{tierIcon(r.tiers?.flag)}</span>
                    <span className="pb-3" />
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
              {/* Reset removed for now — uncomment to restore it.
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
