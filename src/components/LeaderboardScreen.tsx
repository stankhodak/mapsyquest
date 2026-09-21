import { useEffect, useRef, useState } from 'react';
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
  /** Board to highlight, e.g. the one a player has just posted to. */
  initialBoard: string;
  /** The signed-in player's id, so their own row can be highlighted. */
  userId: string | null;
  /** True once today's daily challenge is played, so its "Take It!" button is switched off. */
  dailyDone: boolean;
  /** Start the challenge behind a board. */
  onTakeIt: (board: string) => void;
  onBack: () => void;
}

const PLACE_ICON = ['🥇', '🥈', '🥉'];
/** Rows a card shows while collapsed. */
const TOP_SHOWN = PLACE_ICON.length;

type BoardResults = Record<string, LeaderboardResult<LeaderboardRow[]>>;

function BoardCard({
  board,
  result,
  userId,
  highlighted,
  dailyDone,
  onRetry,
  onTakeIt,
}: {
  board: string;
  /** Undefined while the board is still loading. */
  result: LeaderboardResult<LeaderboardRow[]> | undefined;
  userId: string | null;
  highlighted: boolean;
  dailyDone: boolean;
  onRetry: () => void;
  onTakeIt: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = result?.ok ? result.value : [];
  const canExpand = rows.length > TOP_SHOWN;
  const isOpen = expanded && canExpand;
  const played = board === 'daily' && dailyDone;

  return (
    <section
      aria-label={boardLabel(board)}
      className={`space-y-2 rounded-xl border bg-slate-900/60 p-3 ${highlighted ? 'border-sky-500/60' : 'border-slate-800'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            disabled={!canExpand}
            aria-expanded={isOpen}
            className="flex max-w-full items-center gap-1.5 text-left font-bold text-slate-100 enabled:hover:text-white disabled:cursor-default"
          >
            <span className="truncate">{boardLabel(board)}</span>
            {canExpand && (
              <span aria-hidden="true" className="text-[10px] text-slate-400">
                {isOpen ? '▲' : '▼'}
              </span>
            )}
          </button>
        </h3>
        <button
          type="button"
          onClick={onTakeIt}
          disabled={played}
          className="shrink-0 rounded-lg bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-3 py-1 text-xs font-bold text-slate-950 shadow transition hover:scale-[1.05] active:scale-[0.95] disabled:opacity-50 disabled:hover:scale-100"
        >
          {played ? 'Done ✓' : 'Take It!'}
        </button>
      </div>

      {result === undefined && <p className="py-2 text-slate-400">Loading…</p>}

      {result && !result.ok && (
        <div role="alert" className="flex items-center justify-between gap-3 py-2 text-rose-300">
          <span>Couldn't load this board right now.</span>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      )}

      {result?.ok && result.value.length === 0 && <p className="py-2 text-slate-400">No scores yet. Be the first!</p>}

      {rows.length > 0 && (
        // Ten rows (h-9 each) show at once when expanded; the rest of the top 20 scrolls.
        <ol className={`divide-y divide-slate-800 ${isOpen ? 'max-h-90 overflow-y-auto' : ''}`}>
          {(isOpen ? rows : rows.slice(0, TOP_SHOWN)).map((row, i) => {
            const isYou = userId !== null && row.userId === userId;
            return (
              <li key={row.userId} className={`flex h-9 items-center gap-3 ${isYou ? 'bg-sky-500/10' : ''}`}>
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

export function LeaderboardScreen({ initialBoard, userId, dailyDone, onTakeIt, onBack }: LeaderboardScreenProps) {
  // Filled in per board as each fetch finishes, so one slow or failing board doesn't hold up the rest.
  const [results, setResults] = useState<BoardResults>({});
  const mounted = useRef(false);

  function loadBoard(id: string) {
    fetchTopScores(id, boardPeriod(id, todayKey())).then((result) => {
      if (!result.ok) console.warn(`Couldn't load the ${id} leaderboard:`, result.error);
      if (mounted.current) setResults((prev) => ({ ...prev, [id]: result }));
    });
  }

  function retryBoard(id: string) {
    setResults(({ [id]: _failed, ...rest }) => rest);
    loadBoard(id);
  }

  useEffect(() => {
    mounted.current = true;
    if (isLeaderboardAvailable) BOARDS.forEach(({ id }) => loadBoard(id));
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 text-left text-sm text-slate-300">
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-100">🏆 Leaderboards</h2>
        <p className="text-slate-400">
          Top {TOP_SHOWN} players on each board. Tap a board's name to see the top {TOP_SCORES_LIMIT}.
        </p>
      </div>

      {!isLeaderboardAvailable ? (
        <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
          Leaderboards aren't set up yet — check back soon.
        </p>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2">
          {BOARDS.map((b) => (
            <BoardCard
              key={b.id}
              board={b.id}
              result={results[b.id]}
              userId={userId}
              highlighted={b.id === initialBoard}
              dailyDone={dailyDone}
              onRetry={() => retryBoard(b.id)}
              onTakeIt={() => onTakeIt(b.id)}
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
