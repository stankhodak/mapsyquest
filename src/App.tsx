import { useMemo, useState } from 'react';
import { RoundFlow, type RoundResult } from './components/RoundFlow';
import { getDailyCountries, todayKey } from './lib/daily';

function App() {
  const dateKey = useMemo(() => todayKey(), []);
  const dailyCountries = useMemo(() => getDailyCountries(dateKey), [dateKey]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);

  const isGameOver = roundIndex >= dailyCountries.length;

  function handleRoundComplete(result: RoundResult) {
    setResults((prev) => [...prev, result]);
    setRoundIndex((prev) => prev + 1);
  }

  const totalStars = results.reduce((sum, r) => sum + r.stars, 0);
  const totalPoints = results.reduce((sum, r) => sum + r.points, 0);

  return (
    <div className="min-h-svh bg-slate-950 px-4 py-8 text-slate-100">
      <header className="mx-auto mb-8 max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">MapsyQuest</h1>
        <p className="text-sm text-slate-400">Daily geography guessing game — {dateKey}</p>
      </header>

      <main>
        {!isGameOver && (
          <RoundFlow
            key={dailyCountries[roundIndex].id}
            country={dailyCountries[roundIndex]}
            roundNumber={roundIndex + 1}
            totalRounds={dailyCountries.length}
            onRoundComplete={handleRoundComplete}
          />
        )}

        {isGameOver && (
          <div className="mx-auto w-full max-w-md space-y-6 text-center">
            <h2 className="text-2xl font-semibold">Today's results</h2>
            <p className="text-lg">
              {totalStars} / {dailyCountries.length * 3} stars &middot; {totalPoints} points
            </p>
            <ul className="space-y-2 text-left text-sm text-slate-300">
              {results.map((r) => (
                <li key={r.country.id} className="rounded-lg border border-slate-700 px-3 py-2">
                  <span className="font-medium text-slate-100">{r.country.name}</span> — {r.stars}
                  ⭐ · {r.points} pts
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
