import { useState } from 'react';
import type { Country } from '../data/types';
import { categoryPoints } from '../lib/points';
import { CapitalStep, type CapitalGuessResult } from './CapitalStep';
import { CountryStep, type CountryGuessResult } from './CountryStep';
import { FlagStep, type FlagGuessResult } from './FlagStep';

export interface RoundResult {
  country: Country;
  countryGuess: CountryGuessResult;
  capitalGuess: CapitalGuessResult;
  flagGuess: FlagGuessResult;
  stars: number;
  points: number;
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

  function finishRound() {
    if (!countryGuess || !capitalGuess || !flagGuess) return;

    const stars =
      (countryGuess.isCorrect ? 1 : 0) + (capitalGuess.isStar ? 1 : 0) + (flagGuess.isCorrect ? 1 : 0);

    const points =
      categoryPoints('country', countryGuess.isCorrect ? 1 : 0, countryGuess.elapsedMs) +
      categoryPoints('capital', capitalGuess.score / 100, capitalGuess.elapsedMs) +
      categoryPoints('flag', flagGuess.isCorrect ? 1 : 0, flagGuess.elapsedMs);

    onRoundComplete({ country, countryGuess, capitalGuess, flagGuess, stars, points });
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <p className="text-sm uppercase tracking-wide text-slate-400">
        Round {roundNumber} of {totalRounds}
      </p>

      {step === 'country' && <CountryStep answer={country} onComplete={handleCountryComplete} />}
      {step === 'capital' && <CapitalStep answer={country} onComplete={handleCapitalComplete} />}
      {step === 'flag' && <FlagStep answer={country} onComplete={handleFlagComplete} />}

      {step === 'summary' && countryGuess && capitalGuess && flagGuess && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-slate-100">
            {country.name} — {country.capital}
          </h2>
          <ul className="space-y-1 text-sm text-slate-300">
            <li>
              Country: {countryGuess.isCorrect ? '⭐ correct' : `✗ (you said "${countryGuess.guess}")`}
            </li>
            <li>
              Capital: {capitalGuess.score}% {capitalGuess.isStar ? '⭐' : ''} (you said "
              {capitalGuess.guess}")
            </li>
            <li>Flag: {flagGuess.isCorrect ? '⭐ correct' : '✗ incorrect'}</li>
          </ul>
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
