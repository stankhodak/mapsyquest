import { useEffect, useState } from 'react';
import { todayKey } from '../lib/daily';
import {
  BOARDS,
  boardLabel,
  boardPeriod,
  fetchTopScores,
  formatBoardScore,
  isLeaderboardAvailable,
  TOP_SCORES_LIMIT,
  type LeaderboardResult,
  type LeaderboardRow,
} from '../lib/leaderboard';

interface LeaderboardScreenProps {
  /** Board to show first, e.g. the one a player has just posted to. */
  initialBoard: string;
  /** The signed-in player's id, so their own row can be highlighted. */
  userId: string | null;
  onBack: () => void;
}

const PLACE_ICON = ['🥇', '🥈', '🥉'];

export function LeaderboardScreen({ initialBoard, userId, onBack }: LeaderboardScreenProps) {
  const [board, setBoard] = useState(BOARDS.some((b) => b.id === initialBoard) ? initialBoard : BOARDS[0].id);
  // Kept with the board it was fetched for, so switching boards shows "Loading…" instead of the previous board's rows.
  const [loaded, setLoaded] = useState<{ board: string; result: LeaderboardResult<LeaderboardRow[]> } | null>(null);

  useEffect(() => {
    if (!isLeaderboardAvailable) return;
    let cancelled = false;
    fetchTopScores(board, boardPeriod(board, todayKey())).then((result) => {
      if (!cancelled) setLoaded({ board, result });
    });
    return () => {
      cancelled = true;
    };
  }, [board]);

  const result = loaded?.board === board ? loaded.result : null;

  return (
    <div className="mx-auto w-full max-w-md space-y-4 text-left text-sm text-slate-300">
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-100">🏆 Leaderboards</h2>
        <p className="text-slate-400">Top {TOP_SCORES_LIMIT} players on each board.</p>
      </div>

      {!isLeaderboardAvailable ? (
        <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
          Leaderboards aren't set up yet — check back soon.
        </p>
      ) : (
        <>
          <label className="block text-xs text-slate-400">
            Board
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {BOARDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          {result === null && <p className="py-6 text-center text-slate-400">Loading…</p>}

          {result && !result.ok && (
            <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center text-rose-300">
              Couldn't load this leaderboard right now. Please try again later.
            </p>
          )}

          {result?.ok && result.value.length === 0 && (
            <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
              No scores on {boardLabel(board)} yet. Be the first!
            </p>
          )}

          {result?.ok && result.value.length > 0 && (
            <ol className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/60">
              {result.value.map((row, i) => {
                const isYou = userId !== null && row.userId === userId;
                return (
                  <li
                    key={row.userId}
                    className={`flex items-center gap-3 px-3 py-2 ${isYou ? 'bg-sky-500/10' : ''}`}
                  >
                    <span className="w-7 shrink-0 text-center text-base">{PLACE_ICON[i] ?? i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-100">
                      {row.nickname}
                      {isYou && <span className="ml-1.5 text-xs font-normal text-sky-300">(you)</span>}
                    </span>
                    <span className="shrink-0 font-semibold text-emerald-400">{formatBoardScore(board, row.score)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      <div className="text-center">
        <button type="button" onClick={onBack} className="text-sm text-slate-400 underline hover:text-slate-200">
          Return to main screen
        </button>
      </div>
    </div>
  );
}
