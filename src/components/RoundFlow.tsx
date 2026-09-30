import { useEffect, useState } from 'react';
import type { Country } from '../data/types';
import { starMultiplier, tierIcon, type StarTier } from '../lib/points';
import { RoundBadge } from './Badge';
import { CapitalStep, type CapitalGuessResult, type CapitalStepState } from './CapitalStep';
import { CountryStep, type CountryGuessResult, type CountryStepState } from './CountryStep';
import { FlagStep, type FlagGuessResult, type FlagStepState } from './FlagStep';

export interface RoundTiers {
  country: StarTier;
  capital: StarTier;
  flag: StarTier;
}

export interface RoundResult {
  country: Country;
  countryGuess: CountryGuessResult;
  capitalGuess: CapitalGuessResult;
  flagGuess: FlagGuessResult;
  stars: number;
  points: number;
  tiers: RoundTiers;
}

/**
 * Everything needed to pick a round up again exactly where it was left: the guesses
 * already in, plus the part-way state of the step being played. The step itself is
 * whichever guess is still missing.
 */
export interface RoundProgress {
  countryGuess: CountryGuessResult | null;
  capitalGuess: CapitalGuessResult | null;
  flagGuess: FlagGuessResult | null;
  countryStep: CountryStepState | null;
  capitalStep: CapitalStepState | null;
  flagStep: FlagStepState | null;
}

const NEW_ROUND: RoundProgress = {
  countryGuess: null,
  capitalGuess: null,
  flagGuess: null,
  countryStep: null,
  capitalStep: null,
  flagStep: null,
};

interface RoundFlowProps {
  country: Country;
  roundNumber: number;
  totalRounds: number;
  onRoundComplete: (result: RoundResult) => void;
  /** Where to resume from, if the round was left part-way. */
  saved?: RoundProgress | null;
  onProgress?: (progress: RoundProgress) => void;
}

export function RoundFlow({
  country,
  roundNumber,
  totalRounds,
  onRoundComplete,
  saved = null,
  onProgress,
}: RoundFlowProps) {
  const [progress, setProgress] = useState<RoundProgress>(() => saved ?? NEW_ROUND);
  const { countryGuess, capitalGuess, flagGuess } = progress;
  const step = !countryGuess ? 'country' : !capitalGuess ? 'capital' : !flagGuess ? 'flag' : 'summary';

  useEffect(() => {
    onProgress?.(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  function update(changes: Partial<RoundProgress>) {
    setProgress((prev) => ({ ...prev, ...changes }));
  }

  const allGuessesIn = countryGuess !== null && capitalGuess !== null && flagGuess !== null;
  const stars = allGuessesIn
    ? (countryGuess.isCorrect ? 1 : 0) + (capitalGuess.isStar ? 1 : 0) + (flagGuess.isCorrect ? 1 : 0)
    : 0;
  const multiplier = starMultiplier(stars);
  const roundPoints = allGuessesIn
    ? Math.round((countryGuess.score + capitalGuess.score + flagGuess.score) * multiplier)
    : 0;

  function finishRound() {
    if (!countryGuess || !capitalGuess || !flagGuess) return;
    const tiers: RoundTiers = { country: countryGuess.tier, capital: capitalGuess.tier, flag: flagGuess.tier };
    onRoundComplete({ country, countryGuess, capitalGuess, flagGuess, stars, points: roundPoints, tiers });
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      {step === 'country' && (
        <CountryStep
          answer={country}
          roundNumber={roundNumber}
          totalRounds={totalRounds}
          saved={progress.countryStep}
          onStateChange={(countryStep) => update({ countryStep })}
          onComplete={(result) => update({ countryGuess: result, countryStep: null })}
        />
      )}
      {step === 'capital' && (
        <CapitalStep
          answer={country}
          roundNumber={roundNumber}
          totalRounds={totalRounds}
          saved={progress.capitalStep}
          onStateChange={(capitalStep) => update({ capitalStep })}
          onComplete={(result) => update({ capitalGuess: result, capitalStep: null })}
        />
      )}
      {step === 'flag' && (
        <FlagStep
          answer={country}
          roundNumber={roundNumber}
          totalRounds={totalRounds}
          saved={progress.flagStep}
          onStateChange={(flagStep) => update({ flagStep })}
          onComplete={(result) => update({ flagGuess: result, flagStep: null })}
        />
      )}

      {step === 'summary' && countryGuess && capitalGuess && flagGuess && (
        <div className="space-y-4">
          <RoundBadge>
            Round {roundNumber} of {totalRounds}
          </RoundBadge>
          <h2 className="text-lg font-medium text-slate-100">
            {country.name} — {country.capital}
          </h2>
          <ul className="space-y-1 text-sm text-slate-300">
            <li>
              Country: {tierIcon(countryGuess.tier)}{' '}
              {countryGuess.isCorrect
                ? `correct (${countryGuess.score} pts)`
                : `(you said "${countryGuess.guess}")`}
            </li>
            <li>
              Capital: {tierIcon(capitalGuess.tier)} {capitalGuess.score} pts (you said "{capitalGuess.guess}") —
              correct: {country.capital}
            </li>
            <li>
              Flag: {tierIcon(flagGuess.tier)} {flagGuess.isCorrect ? `correct (${flagGuess.score} pts)` : 'incorrect'}
            </li>
          </ul>
          <p className="text-base font-semibold text-slate-100">
            {stars} {stars === 1 ? 'star' : 'stars'} · {roundPoints} points ({multiplier}x)
          </p>
          <button
            type="button"
            onClick={finishRound}
            className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white"
          >
            {roundNumber < totalRounds ? 'Next round' : 'See results'}
          </button>
        </div>
      )}
    </div>
  );
}
