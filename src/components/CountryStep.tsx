import { useEffect, useState } from 'react';
import { countries } from '../data/countries';
import type { Country } from '../data/types';
import { MAX_SCORE, tryFraction } from '../lib/points';
import { FeedbackBadge, type FeedbackTone } from './Badge';
import { MapScope } from './MapScope';

export interface CountryGuessResult {
  guess: string;
  isCorrect: boolean;
  score: number;
}

interface CountryStepProps {
  answer: Country;
  onComplete: (result: CountryGuessResult) => void;
  onAttemptChange?: (current: number, max: number) => void;
}

const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 8;
const MAX_TRIES = 3;
/** How long the feedback badge (and MapScope's matching flash) shows before advancing. */
const FEEDBACK_DELAY_MS = 900;

interface Feedback {
  tone: FeedbackTone;
  label: string;
}

export function CountryStep({ answer, onComplete, onAttemptChange }: CountryStepProps) {
  const [query, setQuery] = useState('');
  const [tryNumber, setTryNumber] = useState(1);
  const [flashSignal, setFlashSignal] = useState(0);
  const [flashGuessId, setFlashGuessId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    onAttemptChange?.(tryNumber, MAX_TRIES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tryNumber]);

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
    setLocked(true);

    if (isCorrect) {
      const score = Math.round(MAX_SCORE.country * tryFraction(tryNumber));
      setFeedback({ tone: 'correct', label: 'Correct!' });
      window.setTimeout(() => onComplete({ guess: name, isCorrect: true, score }), FEEDBACK_DELAY_MS);
      return;
    }

    // Flash the actual (wrong) guessed country's outline in red, if it matched a real
    // country — no map flash for unrecognised text (typos/gibberish), per design.
    const guessedCountry = countries.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    setFlashGuessId(guessedCountry?.id ?? null);
    setFlashSignal((s) => s + 1);
    setFeedback({ tone: 'wrong', label: 'Wrong' });

    if (tryNumber >= MAX_TRIES) {
      window.setTimeout(() => onComplete({ guess: name, isCorrect: false, score: 0 }), FEEDBACK_DELAY_MS);
    } else {
      window.setTimeout(() => {
        setTryNumber((t) => t + 1);
        setQuery('');
        setLocked(false);
        setFeedback(null);
      }, FEEDBACK_DELAY_MS);
    }
  }

  function skip() {
    if (locked) return;
    onComplete({ guess: '(skipped)', isCorrect: false, score: 0 });
  }

  const onFinalTry = tryNumber >= MAX_TRIES;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium text-slate-100">Which country is this?</h2>
      <MapScope
        center={answer.center}
        zoom={answer.mapZoom}
        countryId={answer.id}
        revealOutline={onFinalTry}
        fitToOutline={onFinalTry}
        flashGuessId={flashGuessId}
        flashSignal={flashSignal}
      />
      {feedback && <FeedbackBadge tone={feedback.tone}>{feedback.label}</FeedbackBadge>}
      {onFinalTry && !feedback && (
        <p className="text-xs text-slate-400">Last try — outline revealed on the map</p>
      )}
      <div className="relative">
        <input
          autoFocus
          value={query}
          disabled={locked}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          onChange={(e) => {
            setQuery(e.target.value);
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
      <div className="flex items-center justify-end gap-2">
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
  );
}
