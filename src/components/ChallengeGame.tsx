import { useEffect, useState } from 'react';
import type { Country } from '../data/types';
import { recordGame } from '../lib/achievementStore';
import type { EarnedAchievement, RoundSummary } from '../lib/achievements';
import {
  formatChallengeTime,
  timePenaltySeconds,
  wrongGuessesForTier,
  type ChallengeSetup,
} from '../lib/challenges';
import { todayKey } from '../lib/daily';
import { buildGameSummary, countryRoundSummary, fullRoundSummary } from '../lib/gameSummaries';
import { buildEntry, type BoardEntry } from '../lib/leaderboard';
import { recordCompletedGame } from '../lib/playerStats';
import { tierIcon } from '../lib/points';
import { clearProgress, saveProgress } from '../lib/storage';
import { ChallengeResults, type RoundOutcome } from './ChallengeResults';
import { CountryStep, type CountryGuessResult, type CountryStepState } from './CountryStep';
import type { LeaderboardAccount } from './LeaderboardOffer';
import { RoundFlow, type RoundProgress, type RoundResult } from './RoundFlow';

/** An unfinished challenge, saved so it resumes (the same day) after the player leaves it. */
export interface ChallengeProgress {
  setup: ChallengeSetup;
  countryIds: string[];
  records: OutcomeRecord[];
  /** When the game began; the Time Challenge clock keeps running while the game is left. */
  startedAt: number;
  /** The Full Round being played, part-way. */
  round: RoundProgress | null;
  /** The country step being played, part-way (every other kind). */
  countryStep: CountryStepState | null;
}

interface ChallengeGameProps {
  setup: ChallengeSetup;
  title: string;
  countries: Country[];
  /** Where to resume from, if the game was left part-way. */
  saved?: ChallengeProgress | null;
  account: LeaderboardAccount | null;
  onLogin: () => void;
  onViewBoard: (board: string) => void;
  onPlayAgain: () => void;
  onExit: () => void;
}

interface OutcomeRecord extends RoundOutcome {
  round: RoundSummary;
  wrongGuesses: number;
}

/** Owns its own ticking so the clock doesn't re-render the map on every tick. */
function Stopwatch({
  startedAt,
  stoppedAt,
  penaltySeconds,
}: {
  startedAt: number;
  stoppedAt: number | null;
  penaltySeconds: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (stoppedAt !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [stoppedAt]);

  const elapsedSeconds = ((stoppedAt ?? now) - startedAt) / 1000;
  return (
    <div className="flex items-center justify-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 py-1.5 text-sm">
      <span className="font-mono text-lg font-bold tabular-nums text-sky-300">
        ⏱ {formatChallengeTime(elapsedSeconds + penaltySeconds)}
      </span>
      {penaltySeconds > 0 && <span className="font-semibold text-rose-400">+{penaltySeconds}s penalties</span>}
    </div>
  );
}

export function ChallengeGame({
  setup,
  title,
  countries,
  saved = null,
  account,
  onLogin,
  onViewBoard,
  onPlayAgain,
  onExit,
}: ChallengeGameProps) {
  const { kind, region } = setup;
  const owner = account?.userId ?? null;
  const [dateKey] = useState(() => todayKey());
  const [records, setRecords] = useState<OutcomeRecord[]>(() => saved?.records ?? []);
  const [startedAt] = useState(() => saved?.startedAt ?? Date.now());
  const [round, setRound] = useState<RoundProgress | null>(() => saved?.round ?? null);
  const [countryStep, setCountryStep] = useState<CountryStepState | null>(() => saved?.countryStep ?? null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [earned, setEarned] = useState<EarnedAchievement[]>([]);
  const [entry, setEntry] = useState<BoardEntry | null>(null);

  const totalRounds = countries.length;
  const isTimed = kind === 'time';
  const penaltyOf = (rs: OutcomeRecord[]) => timePenaltySeconds(rs.reduce((sum, r) => sum + r.wrongGuesses, 0));
  const penaltySeconds = penaltyOf(records);
  // Wrong guesses on the country being played, charged on the clock straight away instead of when it ends.
  const liveWrongGuesses = countryStep?.wrongGuesses ?? 0;

  useEffect(() => {
    if (finishedAt !== null) return;
    const progress: ChallengeProgress = {
      setup,
      countryIds: countries.map((c) => c.id),
      records,
      startedAt,
      round,
      countryStep,
    };
    saveProgress('challenge-progress', dateKey, progress, owner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, round, countryStep, finishedAt]);

  function record(outcome: OutcomeRecord) {
    const next = [...records, outcome];
    setRecords(next);
    setRound(null);
    setCountryStep(null);
    if (next.length === totalRounds) finishGame(next);
  }

  function quit() {
    clearProgress('challenge-progress', owner);
    onExit();
  }

  /**
   * Runs from the event handler that records the last round (not an effect) so the
   * achievement profile is updated exactly once — effects run twice under StrictMode.
   */
  function finishGame(all: OutcomeRecord[]) {
    const now = Date.now();
    clearProgress('challenge-progress', owner);
    const penalty = penaltyOf(all);
    const game = buildGameSummary({
      kind,
      region,
      rounds: all.map((r) => r.round),
      ...(isTimed ? { timeSeconds: (now - startedAt) / 1000 + penalty, penaltySeconds: penalty } : {}),
    });
    const { earned: newlyEarned } = recordGame(game, 0, account?.userId ?? null);
    if (account) {
      void recordCompletedGame(
        account.userId,
        game.rounds.reduce((sum, r) => sum + r.stars, 0),
        game.rounds.reduce((sum, r) => sum + r.points, 0),
      );
    }
    setEarned(newlyEarned);
    setEntry(
      buildEntry(
        game,
        newlyEarned.map((a) => a.id),
        todayKey(),
      ),
    );
    setFinishedAt(now);
  }

  function handleGuess(country: Country, result: CountryGuessResult) {
    const wrongGuesses = wrongGuessesForTier(result.tier);
    record({
      country,
      icons: tierIcon(result.tier),
      detail: isTimed ? (wrongGuesses > 0 ? `+${timePenaltySeconds(wrongGuesses)}s` : '—') : `${result.score} pts`,
      round: countryRoundSummary(country, result),
      wrongGuesses,
    });
  }

  function handleFullRound(country: Country, result: RoundResult) {
    record({
      country,
      icons: `${tierIcon(result.tiers.country)}${tierIcon(result.tiers.capital)}${tierIcon(result.tiers.flag)}`,
      detail: `${result.points} pts`,
      round: fullRoundSummary(result),
      wrongGuesses: 0,
    });
  }

  if (records.length >= totalRounds && finishedAt !== null) {
    const totalPoints = records.reduce((sum, r) => sum + r.round.points, 0);
    const totalStars = records.reduce((sum, r) => sum + r.round.stars, 0);
    const rawSeconds = (finishedAt - startedAt) / 1000;

    let headline: string;
    let subLines: string[];
    if (isTimed) {
      headline = formatChallengeTime(rawSeconds + penaltySeconds);
      subLines = [
        `${formatChallengeTime(rawSeconds)} on the clock + ${penaltySeconds}s in penalties`,
      ];
    } else {
      headline = `${totalPoints.toLocaleString()} pts`;
      subLines =
        kind === 'regional-full'
          ? [`⭐ ${totalStars} / ${totalRounds * 3} stars`]
          : [`${totalStars} / ${totalRounds} countries found`];
    }

    return (
      <div className="mx-auto w-full max-w-md">
        <ChallengeResults
          title={title}
          headline={headline}
          subLines={subLines}
          outcomes={records}
          earned={earned}
          entry={entry}
          account={account}
          onLogin={onLogin}
          onViewBoard={onViewBoard}
          onPlayAgain={onPlayAgain}
          onExit={onExit}
        />
      </div>
    );
  }

  const index = records.length;
  const country = countries[index];
  const stepKey = `${index}-${country.id}`;

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={quit} className="shrink-0 text-sm text-slate-400 underline hover:text-slate-200">
          ← Quit
        </button>
        <span className="min-w-0 truncate text-sm font-semibold text-slate-300">{title}</span>
      </div>

      {isTimed && (
        <Stopwatch
          startedAt={startedAt}
          stoppedAt={finishedAt}
          penaltySeconds={penaltySeconds + timePenaltySeconds(liveWrongGuesses)}
        />
      )}

      {kind === 'regional-full' ? (
        <RoundFlow
          key={stepKey}
          country={country}
          roundNumber={index + 1}
          totalRounds={totalRounds}
          saved={round}
          onProgress={setRound}
          onRoundComplete={(result) => handleFullRound(country, result)}
        />
      ) : (
        <CountryStep
          key={stepKey}
          answer={country}
          roundNumber={index + 1}
          totalRounds={totalRounds}
          clue={kind === 'flag' ? 'flag' : 'map'}
          saved={countryStep}
          onStateChange={setCountryStep}
          onComplete={(result) => handleGuess(country, result)}
        />
      )}
    </div>
  );
}
