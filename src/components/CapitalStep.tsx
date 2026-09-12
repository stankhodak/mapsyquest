import { useState } from 'react';
import type { Country } from '../data/types';
import { MAX_SCORE, tryFraction } from '../lib/points';
import { scoreCapitalGuess } from '../lib/scoring';
import { AttemptBadge, FeedbackBadge, type FeedbackTone } from './Badge';
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
const FEEDBACK_DELAY_MS = 900;

interface Feedback {
  tone: FeedbackTone;
  label: string;
}

export function CapitalStep({ answer, onComplete }: CapitalStepProps) {
  const [value, setValue] = useState('');
  const [tryNumber, setTryNumber] = useState(1);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  function submit() {
    if (!value.trim() || locked) return;
    const { score: similarity, isStar } = scoreCapitalGuess(value, answer.capital);
    setLocked(true);

    // A strong (≥95%) guess locks in immediately; anything weaker keeps trying until
    // tries run out, at which point the last guess's similarity (already floored to 0
    // below the 60% wrong-threshold) is what gets scored.
    if (isStar || tryNumber >= MAX_TRIES) {
      const score = Math.round(MAX_SCORE.capital * tryFraction(tryNumber) * (similarity / 100));
      setFeedback(
        isStar
          ? { tone: 'correct', label: 'Correct!' }
          : similarity > 0
            ? { tone: 'close', label: 'So Close!' }
            : { tone: 'wrong', label: 'Wrong' },
      );
      window.setTimeout(() => onComplete({ guess: value, score, isStar }), FEEDBACK_DELAY_MS);
      return;
    }

    setFeedback(similarity > 0 ? { tone: 'close', label: 'So Close!' } : { tone: 'wrong', label: 'Wrong' });
    window.setTimeout(() => {
      setTryNumber((t) => t + 1);
      setValue('');
      setLocked(false);
      setFeedback(null);
    }, FEEDBACK_DELAY_MS);
  }

  function skip() {
    if (locked) return;
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
        fitToOutline
        revealName
        labelPosition={answer.center}
      />
      <div className="flex flex-wrap items-center gap-3">
        <AttemptBadge>
          Attempt {tryNumber} of {MAX_TRIES}
        </AttemptBadge>
        {feedback && <FeedbackBadge tone={feedback.tone}>{feedback.label}</FeedbackBadge>}
      </div>
      <input
        autoFocus
        value={value}
        disabled={locked}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="Type the capital..."
        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
      />
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
          onClick={submit}
          disabled={!value.trim() || locked}
          className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          Guess
        </button>
      </div>
    </div>
  );
}
