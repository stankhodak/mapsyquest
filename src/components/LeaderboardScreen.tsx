import { useEffect, useState } from 'react';
import { todayKey } from '../lib/daily';
import {
  BOARDS,
  boardLabel,
  boardPeriod,
  fetchTopScores,
  formatBoardScore,
  isLeaderboardAvailable,
  type LeaderboardResult,
  type LeaderboardRow,
} from '../lib/leaderboard';

interface LeaderboardScreenProps {
  /** Board to highlight, e.g. the one a player has just posted to. */
  initialBoard: string;
  /** The signed-in player's id, so their own row can be highlighted. */
  userId: string | null;
  onBack: () => void;
}

const PLACE_ICON = ['🥇', '🥈', '🥉'];
const TOP_SHOWN = PLACE_ICON.length;

type BoardResults = Record<string, LeaderboardResult<LeaderboardRow[]>>;

function BoardCard({
  board,
  result,
  userId,
  highlighted,
}: {
  board: string;
  /** Undefined while the board is still loading. */
  result: LeaderboardResult<LeaderboardRow[]> | undefined;
  userId: string | null;
  highlighted: boolean;
}) {
  return (
    <section
      aria-label={boardLabel(board)}
      className={`space-y-2 rounded-xl border bg-slate-900/60 p-3 ${highlighted ? 'border-sky-500/60' : 'border-slate-800'}`}
    >
      <h3 className="font-bold text-slate-100">{boardLabel(board)}</h3>

      {result === undefined && <p className="py-2 text-slate-400">Loading…</p>}

      {result && !result.ok && (
        <p role="alert" className="py-2 text-rose-300">
          Couldn't load this board right now.
        </p>
      )}

      {result?.ok && result.value.length === 0 && <p className="py-2 text-slate-400">No scores yet. Be the first!</p>}

      {result?.ok && result.value.length > 0 && (
        <ol className="divide-y divide-slate-800">
          {result.value.map((row, i) => {
            const isYou = userId !== null && row.userId === userId;
            return (
              <li key={row.userId} className={`flex items-center gap-3 py-1.5 ${isYou ? 'bg-sky-500/10' : ''}`}>
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
    </section>
  );
}

export function LeaderboardScreen({ initialBoard, userId, onBack }: LeaderboardScreenProps) {
  // Filled in per board as each fetch finishes, so one slow or failing board doesn't hold up the rest.
  const [results, setResults] = useState<BoardResults>({});

  useEffect(() => {
    if (!isLeaderboardAvailable) return;
    let cancelled = false;
    const today = todayKey();
    for (const { id } of BOARDS) {
      fetchTopScores(id, boardPeriod(id, today), TOP_SHOWN).then((result) => {
        if (!cancelled) setResults((prev) => ({ ...prev, [id]: result }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 text-left text-sm text-slate-300">
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-100">🏆 Leaderboards</h2>
        <p className="text-slate-400">Top {TOP_SHOWN} players on each board.</p>
      </div>

      {!isLeaderboardAvailable ? (
        <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
          Leaderboards aren't set up yet — check back soon.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {BOARDS.map((b) => (
            <BoardCard
              key={b.id}
              board={b.id}
              result={results[b.id]}
              userId={userId}
              highlighted={b.id === initialBoard}
            />
          ))}
        </div>
      )}

      <div className="text-center">
        <button type="button" onClick={onBack} className="text-sm text-slate-400 underline hover:text-slate-200">
          Return to main screen
        </button>
      </div>
    </div>
  );
}
