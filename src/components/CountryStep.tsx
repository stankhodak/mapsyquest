import { useState } from 'react';
import { countries } from '../data/countries';
import type { Country } from '../data/types';
import { MapScope } from './MapScope';

export interface CountryGuessResult {
  guess: string;
  isCorrect: boolean;
  elapsedMs: number;
}

interface CountryStepProps {
  answer: Country;
  onComplete: (result: CountryGuessResult) => void;
}

const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 8;

export function CountryStep({ answer, onComplete }: CountryStepProps) {
  const [query, setQuery] = useState('');
  const [startTime] = useState(() => Date.now());

  const trimmed = query.trim();
  const matches =
    trimmed.length >= MIN_QUERY_LENGTH
      ? countries
          .filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()))
          .slice(0, MAX_SUGGESTIONS)
      : [];

  function submit(name: string) {
    if (!name.trim()) return;
    onComplete({
      guess: name,
      isCorrect: name.trim().toLowerCase() === answer.name.toLowerCase(),
      elapsedMs: Date.now() - startTime,
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-slate-100">Which country is this?</h2>
      <MapScope center={answer.center} zoom={answer.mapZoom} />
      <div className="relative">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(query);
          }}
          placeholder="Type a country name..."
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        {matches.length > 0 && (
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
      <button
        type="button"
        onClick={() => submit(query)}
        disabled={!trimmed}
        className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white disabled:opacity-40"
      >
        Guess
      </button>
    </div>
  );
}
