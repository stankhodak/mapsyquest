import { useState } from 'react';
import { RoundFlow, type RoundResult } from './components/RoundFlow';
import type { Country } from './data/types';
import { getDailyCountries, todayKey } from './lib/daily';
import {
  clearDailyRecord,
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
}

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

  /** Restarts the game: clears today's progress and reshuffles the round order. */
  function handleReset() {
    clearDailyRecord(dateKey);
    setStoredRecord(null);
    setResults([]);
    setRoundIndex(0);
    setPlayOrder(shuffle(getDailyCountries(dateKey)));
    setResetCount((n) => n + 1);
  }

  const summaryRows: SummaryRow[] =
    storedRecord?.results ??
    results.map((r) => ({
      countryId: r.country.id,
      countryName: r.country.name,
      stars: r.stars,
      points: r.points,
    }));
  const totalStars = storedRecord?.totalStars ?? results.reduce((sum, r) => sum + r.stars, 0);
  const totalPoints = storedRecord?.totalPoints ?? results.reduce((sum, r) => sum + r.points, 0);

  return (
    <div className="min-h-svh bg-slate-950 px-4 py-8 text-slate-100">
      <header className="mx-auto mb-8 max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">MapsyQuest</h1>
        <p className="text-sm text-slate-400">Daily geography guessing game — {dateKey}</p>
      </header>

      <main>
        {!isGameOver && (
          <RoundFlow
            key={`${resetCount}-${playOrder[roundIndex].id}`}
            country={playOrder[roundIndex]}
            roundNumber={roundIndex + 1}
            totalRounds={playOrder.length}
            onRoundComplete={handleRoundComplete}
          />
        )}

        {isGameOver && (
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
            <ul className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 text-left text-sm text-slate-300">
              {summaryRows.map((r) => (
                <li key={r.countryId} className="contents">
                  <span className="truncate font-medium text-slate-100">{r.countryName}</span>
                  <span className="text-right">{r.stars}⭐</span>
                  <span className="text-right">{r.points} pts</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">Come back tomorrow for a new set of countries.</p>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Reset
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
