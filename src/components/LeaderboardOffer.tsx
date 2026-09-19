import { useState } from 'react';
import {
  boardShortLabel,
  formatBoardScore,
  isLeaderboardAvailable,
  MAX_NICKNAME_LENGTH,
  saveNickname,
  submitScore,
  type BoardEntry,
  type SubmitOutcome,
} from '../lib/leaderboard';

export interface LeaderboardAccount {
  userId: string;
  /** Prefilled into the nickname field; the player confirms or edits it before posting. */
  suggestedNickname: string;
}

interface LeaderboardOfferProps {
  /** What this game would post, or null if it has nothing to post. */
  entry: BoardEntry | null;
  /** The signed-in player, or null for a guest. */
  account: LeaderboardAccount | null;
  onLogin: () => void;
  onViewBoard: (board: string) => void;
}

type Status = 'idle' | 'posting' | 'done' | 'error';

/** The end-of-game offer to add this score to the public leaderboard. */
export function LeaderboardOffer({ entry, account, onLogin, onViewBoard }: LeaderboardOfferProps) {
  const [nickname, setNickname] = useState(account?.suggestedNickname ?? '');
  const [status, setStatus] = useState<Status>('idle');
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);

  if (!isLeaderboardAvailable || !entry) return null;

  const boardName = boardShortLabel(entry.board);
  const cardClass = 'space-y-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-center';

  if (!account) {
    return (
      <section aria-label="Leaderboard" className={cardClass}>
        <p className="text-sm font-bold text-sky-200">🏆 Add your score to the leaderboard</p>
        <p className="text-xs text-slate-400">Log in to post scores and see how you rank.</p>
        <button
          type="button"
          onClick={onLogin}
          className="rounded-lg border border-sky-500/60 px-3 py-1.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
        >
          Log in
        </button>
      </section>
    );
  }

  async function handlePost() {
    if (!account || !entry || status === 'posting') return;
    setStatus('posting');
    const result = await submitScore(account.userId, nickname, entry);
    if (!result.ok) {
      console.error('Leaderboard post failed:', result.error);
      setStatus('error');
      return;
    }
    setOutcome(result.value);
    setStatus('done');
    void saveNickname(nickname);
  }

  if (status === 'done' && outcome) {
    const place = outcome.rank !== null ? ` You're #${outcome.rank}.` : '';
    return (
      <section aria-label="Leaderboard" className={cardClass}>
        <p role="status" className="text-sm font-bold text-sky-200">
          {outcome.improved ? '✅ Posted!' : '👍 Already on the board'}
        </p>
        <p className="text-xs text-slate-300">
          {outcome.improved
            ? `Your ${formatBoardScore(entry.board, entry.score)} is on the ${boardName} board.${place}`
            : `You already have a better score on the ${boardName} board, so it was kept.${place}`}
        </p>
        <button
          type="button"
          onClick={() => onViewBoard(entry.board)}
          className="rounded-lg border border-sky-500/60 px-3 py-1.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
        >
          View leaderboard
        </button>
      </section>
    );
  }

  const isPosting = status === 'posting';

  return (
    <section aria-label="Leaderboard" className={cardClass}>
      <p className="text-sm font-bold text-sky-200">🏆 Add your score to the leaderboard?</p>
      <p className="text-xs text-slate-300">
        {formatBoardScore(entry.board, entry.score)} on the {boardName} board
      </p>
      <label className="block text-left text-xs text-slate-400">
        Nickname
        <input
          type="text"
          value={nickname}
          maxLength={MAX_NICKNAME_LENGTH}
          disabled={isPosting}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Choose a nickname"
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
        />
      </label>
      <p className="text-[11px] text-slate-500">Your nickname and score will be visible to everyone.</p>
      {status === 'error' && (
        <p role="alert" className="text-xs text-rose-400">
          Couldn't post your score right now. Please try again in a moment.
        </p>
      )}
      <button
        type="button"
        onClick={handlePost}
        disabled={isPosting || !nickname.trim()}
        className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {isPosting ? 'Posting…' : status === 'error' ? 'Try again' : 'Add to leaderboard'}
      </button>
    </section>
  );
}
