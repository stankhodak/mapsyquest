import { useMemo, useState } from 'react';
import { RoundFlow, type RoundResult } from './components/RoundFlow';
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

function App() {
  const dateKey = useMemo(() => todayKey(), []);
  const dailyCountries = useMemo(() => getDailyCountries(dateKey), [dateKey]);

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
  const isGameOver = storedRecord !== null || roundIndex >= dailyCountries.length;

  function handleRoundComplete(result: RoundResult) {
    setResults((prev) => {
      const next = [...prev, result];
      if (next.length === dailyCountries.length) {
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

  /** Technical/testing helper: wipes today's progress so the day can be replayed. */
  function handleReset() {
    clearDailyRecord(dateKey);
    setStoredRecord(null);
    setResults([]);
    setRoundIndex(0);
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
            key={`${resetCount}-${dailyCountries[roundIndex].id}`}
            country={dailyCountries[roundIndex]}
            roundNumber={roundIndex + 1}
            totalRounds={dailyCountries.length}
            onRoundComplete={handleRoundComplete}
            onReset={handleReset}
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
              {totalStars} / {dailyCountries.length * 3} stars &middot; {totalPoints} points
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
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
