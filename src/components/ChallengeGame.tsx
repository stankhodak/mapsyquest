import { useEffect, useState } from 'react';
import type { Country } from '../data/types';
import {
  formatChallengeTime,
  TIME_PENALTY_SECONDS,
  wrongGuessesForTier,
  type ChallengeKind,
} from '../lib/challenges';
import { tierIcon } from '../lib/points';
import { ChallengeResults, type RoundOutcome } from './ChallengeResults';
import { CountryStep, type CountryGuessResult } from './CountryStep';
import { RoundFlow, type RoundResult } from './RoundFlow';

interface ChallengeGameProps {
  kind: ChallengeKind;
  title: string;
  countries: Country[];
  onPlayAgain: () => void;
  onExit: () => void;
}

interface OutcomeRecord extends RoundOutcome {
  points: number;
  stars: number;
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

export function ChallengeGame({ kind, title, countries, onPlayAgain, onExit }: ChallengeGameProps) {
  const [records, setRecords] = useState<OutcomeRecord[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  const totalRounds = countries.length;
  const isTimed = kind === 'time';
  const penaltySeconds = records.reduce((sum, r) => sum + r.wrongGuesses, 0) * TIME_PENALTY_SECONDS;

  function record(outcome: OutcomeRecord) {
    const next = [...records, outcome];
    setRecords(next);
    if (next.length === totalRounds) setFinishedAt(Date.now());
  }

  function handleGuess(country: Country, result: CountryGuessResult) {
    const wrongGuesses = wrongGuessesForTier(result.tier);
    record({
      country,
      icons: tierIcon(result.tier),
      detail: isTimed ? (wrongGuesses > 0 ? `+${wrongGuesses * TIME_PENALTY_SECONDS}s` : '—') : `${result.score} pts`,
      points: result.score,
      stars: result.tier ? 1 : 0,
      wrongGuesses,
    });
  }

  function handleFullRound(country: Country, result: RoundResult) {
    record({
      country,
      icons: `${tierIcon(result.tiers.country)}${tierIcon(result.tiers.capital)}${tierIcon(result.tiers.flag)}`,
      detail: `${result.points} pts`,
      points: result.points,
      stars: result.stars,
      wrongGuesses: 0,
    });
  }

  if (records.length >= totalRounds && finishedAt !== null) {
    const totalPoints = records.reduce((sum, r) => sum + r.points, 0);
    const totalStars = records.reduce((sum, r) => sum + r.stars, 0);
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
        <button type="button" onClick={onExit} className="shrink-0 text-sm text-slate-400 underline hover:text-slate-200">
          ← Quit
        </button>
        <span className="min-w-0 truncate text-sm font-semibold text-slate-300">{title}</span>
      </div>

      {isTimed && <Stopwatch startedAt={startedAt} stoppedAt={finishedAt} penaltySeconds={penaltySeconds} />}

      {kind === 'regional-full' ? (
        <RoundFlow
          key={stepKey}
          country={country}
          roundNumber={index + 1}
          totalRounds={totalRounds}
          onRoundComplete={(result) => handleFullRound(country, result)}
        />
      ) : (
        <CountryStep
          key={stepKey}
          answer={country}
          roundNumber={index + 1}
          totalRounds={totalRounds}
          clue={kind === 'flag' ? 'flag' : 'map'}
          onComplete={(result) => handleGuess(country, result)}
        />
      )}
    </div>
  );
}
