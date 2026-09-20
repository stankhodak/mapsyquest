import type { Country } from '../data/types';
import type { EarnedAchievement } from '../lib/achievements';
import { flagImageUrl } from '../lib/flags';
import { AchievementsPanel } from './AchievementsPanel';
import type { BoardEntry } from '../lib/leaderboard';
import { LeaderboardOffer, type LeaderboardAccount } from './LeaderboardOffer';

export interface RoundOutcome {
  country: Country;
  /** Medal emoji(s) for the round, e.g. "🥇" or "🥇🥈❌" for a full round. */
  icons: string;
  /** Right-hand value for the row, e.g. "240 pts" or "+5s". */
  detail: string;
}

interface ChallengeResultsProps {
  title: string;
  /** Big headline number, e.g. "1,250 pts" or "1:23.4". */
  headline: string;
  /** Smaller lines under the headline. */
  subLines: string[];
  outcomes: RoundOutcome[];
  earned: EarnedAchievement[];
  entry: BoardEntry | null;
  account: LeaderboardAccount | null;
  onLogin: () => void;
  onViewBoard: (board: string) => void;
  onPlayAgain: () => void;
  onExit: () => void;
}

export function ChallengeResults({
  title,
  headline,
  subLines,
  outcomes,
  earned,
  entry,
  account,
  onLogin,
  onViewBoard,
  onPlayAgain,
  onExit,
}: ChallengeResultsProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <p className="text-sm font-semibold text-slate-400">{title}</p>
        <p className="text-4xl font-extrabold text-emerald-400">{headline}</p>
        {subLines.map((line) => (
          <p key={line} className="text-sm text-slate-400">
            {line}
          </p>
        ))}
      </div>

      <AchievementsPanel earned={earned} />
      <LeaderboardOffer entry={entry} account={account} onLogin={onLogin} onViewBoard={onViewBoard} />

      <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/60">
        {outcomes.map((outcome) => (
          <li key={outcome.country.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <img src={flagImageUrl(outcome.country.id)} alt="" className="h-5 w-8 shrink-0 rounded-sm object-cover" />
            <span className="min-w-0 flex-1 truncate text-slate-200">{outcome.country.name}</span>
            <span className="shrink-0">{outcome.icons}</span>
            <span className="w-16 shrink-0 text-right text-slate-400">{outcome.detail}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onPlayAgain}
          className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-4 py-3 font-bold text-slate-950 transition active:scale-[0.98]"
        >
          Play again
        </button>
        <button
          type="button"
          onClick={onExit}
          className="flex-1 rounded-xl border border-slate-700 px-4 py-3 font-bold text-slate-200 transition hover:bg-slate-800 active:scale-[0.98]"
        >
          Back to challenges
        </button>
      </div>
    </div>
  );
}
