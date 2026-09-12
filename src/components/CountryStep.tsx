import { useState } from 'react';
import { countries } from '../data/countries';
import type { Country } from '../data/types';
import { MAX_SCORE, tryFraction } from '../lib/points';
import { MapScope } from './MapScope';

export interface CountryGuessResult {
  guess: string;
  isCorrect: boolean;
  score: number;
}

interface CountryStepProps {
  answer: Country;
  onComplete: (result: CountryGuessResult) => void;
}

const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 8;
const MAX_TRIES = 3;
/** Matches MapScope's red-flash duration, so the input unlocks right as the flash fades. */
const RETRY_DELAY_MS = 900;

export function CountryStep({ answer, onComplete }: CountryStepProps) {
  const [query, setQuery] = useState('');
  const [tryNumber, setTryNumber] = useState(1);
  const [flashSignal, setFlashSignal] = useState(0);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const trimmed = query.trim();
  const matches =
    trimmed.length >= MIN_QUERY_LENGTH
      ? countries
          .filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()))
          .slice(0, MAX_SUGGESTIONS)
      : [];

  function submit(name: string) {
    if (!name.trim() || locked) return;
    const isCorrect = name.trim().toLowerCase() === answer.name.toLowerCase();

    if (isCorrect) {
      const score = Math.round(MAX_SCORE.country * tryFraction(tryNumber));
      onComplete({ guess: name, isCorrect: true, score });
      return;
    }

    setLocked(true);
    setFlashSignal((s) => s + 1);

    if (tryNumber >= MAX_TRIES) {
      window.setTimeout(() => onComplete({ guess: name, isCorrect: false, score: 0 }), RETRY_DELAY_MS);
    } else {
      const triesLeft = MAX_TRIES - tryNumber;
      setFeedback(`Not quite — ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left`);
      window.setTimeout(() => {
        setTryNumber((t) => t + 1);
        setQuery('');
        setLocked(false);
        setFeedback(null);
      }, RETRY_DELAY_MS);
    }
  }

  function skip() {
    if (locked) return;
    onComplete({ guess: '(skipped)', isCorrect: false, score: 0 });
  }

  const onFinalTry = tryNumber >= MAX_TRIES;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-slate-100">Which country is this?</h2>
      <MapScope
        center={answer.center}
        zoom={answer.mapZoom}
        countryId={answer.id}
        revealOutline={onFinalTry}
        fitToOutline={onFinalTry}
        flashSignal={flashSignal}
      />
      <div className="relative">
        <input
          autoFocus
          value={query}
          disabled={locked}
          onChange={(e) => {
            setQuery(e.target.value);
            setFeedback(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(query);
          }}
          placeholder="Type a country name..."
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
        />
        {matches.length > 0 && !locked && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-600 bg-slate-800 shadow-lg">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => submit(c.name)}
                  className="block w-full px-4 py-2 text-left text-slate-100 hover:bg-slate-700"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-slate-400">
          {feedback ?? (onFinalTry ? 'Last try — outline revealed on the map' : `Attempt ${tryNumber} of ${MAX_TRIES}`)}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={skip}
            disabled={locked}
            className="rounded-lg border border-rose-700 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-950 disabled:opacity-40"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => submit(query)}
            disabled={!trimmed || locked}
            className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white disabled:opacity-40"
          >
            Guess
          </button>
        </div>
      </div>
    </div>
  );
}
