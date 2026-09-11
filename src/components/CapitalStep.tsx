import { useState } from 'react';
import type { Country } from '../data/types';
import { scoreCapitalGuess } from '../lib/scoring';
import { MapScope } from './MapScope';

export interface CapitalGuessResult {
  guess: string;
  score: number;
  isStar: boolean;
  elapsedMs: number;
}

interface CapitalStepProps {
  answer: Country;
  onComplete: (result: CapitalGuessResult) => void;
}

export function CapitalStep({ answer, onComplete }: CapitalStepProps) {
  const [value, setValue] = useState('');
  const [startTime] = useState(() => Date.now());

  function submit() {
    if (!value.trim()) return;
    const { score, isStar } = scoreCapitalGuess(value, answer.capital);
    onComplete({ guess: value, score, isStar, elapsedMs: Date.now() - startTime });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-slate-100">What's the capital of {answer.name}?</h2>
      <MapScope center={answer.capitalCoords} zoom={answer.mapZoom + 1} />
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="Type the capital..."
        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim()}
        className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white disabled:opacity-40"
      >
        Guess
      </button>
    </div>
  );
}
