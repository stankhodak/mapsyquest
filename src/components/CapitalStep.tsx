import { useState } from 'react';
import type { Country } from '../data/types';
import { MAX_SCORE, tryFraction } from '../lib/points';
import { scoreCapitalGuess } from '../lib/scoring';
import { MapScope } from './MapScope';

export interface CapitalGuessResult {
  guess: string;
  score: number;
  isStar: boolean;
}

interface CapitalStepProps {
  answer: Country;
  onComplete: (result: CapitalGuessResult) => void;
}

const MAX_TRIES = 3;

export function CapitalStep({ answer, onComplete }: CapitalStepProps) {
  const [value, setValue] = useState('');
  const [tryNumber, setTryNumber] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  function submit() {
    if (!value.trim()) return;
    const { score: similarity, isStar } = scoreCapitalGuess(value, answer.capital);

    // A strong (≥95%) guess locks in immediately; anything weaker keeps trying until
    // tries run out, at which point the last guess's similarity (already floored to 0
    // below the 60% wrong-threshold) is what gets scored.
    if (isStar || tryNumber >= MAX_TRIES) {
      const score = Math.round(MAX_SCORE.capital * tryFraction(tryNumber) * (similarity / 100));
      onComplete({ guess: value, score, isStar });
      return;
    }

    const triesLeft = MAX_TRIES - tryNumber;
    setFeedback(`Not quite — ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left`);
    setTryNumber((t) => t + 1);
    setValue('');
  }

  function skip() {
    onComplete({ guess: '(skipped)', score: 0, isStar: false });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-slate-100">What's the capital of {answer.name}?</h2>
      <MapScope
        center={answer.capitalCoords}
        zoom={answer.mapZoom + 1}
        countryId={answer.id}
        countryName={answer.name}
        revealOutline
        revealName
      />
      <input
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setFeedback(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="Type the capital..."
        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-slate-400">{feedback ?? `Attempt ${tryNumber} of ${MAX_TRIES}`}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={skip}
            className="rounded-lg border border-rose-700 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-950"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white disabled:opacity-40"
          >
            Guess
          </button>
        </div>
      </div>
    </div>
  );
}
