import { useState } from 'react';
import type { Country } from '../data/types';
import { starMultiplier, tierIcon, type StarTier } from '../lib/points';
import { RoundBadge } from './Badge';
import { CapitalStep, type CapitalGuessResult } from './CapitalStep';
import { CountryStep, type CountryGuessResult } from './CountryStep';
import { FlagStep, type FlagGuessResult } from './FlagStep';

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

interface RoundFlowProps {
  country: Country;
  roundNumber: number;
  totalRounds: number;
  onRoundComplete: (result: RoundResult) => void;
}

type Step = 'country' | 'capital' | 'flag' | 'summary';

export function RoundFlow({ country, roundNumber, totalRounds, onRoundComplete }: RoundFlowProps) {
  const [step, setStep] = useState<Step>('country');
  const [countryGuess, setCountryGuess] = useState<CountryGuessResult | null>(null);
  const [capitalGuess, setCapitalGuess] = useState<CapitalGuessResult | null>(null);
  const [flagGuess, setFlagGuess] = useState<FlagGuessResult | null>(null);

  function handleCountryComplete(result: CountryGuessResult) {
    setCountryGuess(result);
    setStep('capital');
  }

  function handleCapitalComplete(result: CapitalGuessResult) {
    setCapitalGuess(result);
    setStep('flag');
  }

  function handleFlagComplete(result: FlagGuessResult) {
    setFlagGuess(result);
    setStep('summary');
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
          onComplete={handleCountryComplete}
        />
      )}
      {step === 'capital' && (
        <CapitalStep
          answer={country}
          roundNumber={roundNumber}
          totalRounds={totalRounds}
          onComplete={handleCapitalComplete}
        />
      )}
      {step === 'flag' && (
        <FlagStep
          answer={country}
          roundNumber={roundNumber}
          totalRounds={totalRounds}
          onComplete={handleFlagComplete}
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
