import { useState } from 'react';
import type { Country } from '../data/types';
import { MAX_SCORE, tryFraction } from '../lib/points';
import { scoreCapitalGuess } from '../lib/scoring';
import { AttemptBadge, FeedbackBadge, QuestionHeading, type FeedbackTone } from './Badge';
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
/** Tighter than the country step's hint margin, so the country fills most of the frame. */
const OUTLINE_PADDING_FRACTION = 0.12;

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <QuestionHeading>What's the capital of {answer.name}?</QuestionHeading>
        <AttemptBadge current={tryNumber} max={MAX_TRIES} />
      </div>
      <MapScope
        center={answer.capitalCoords}
        zoom={answer.mapZoom + 1}
        countryId={answer.id}
        countryName={answer.name}
        revealOutline
        fitToOutline
        outlinePaddingFraction={OUTLINE_PADDING_FRACTION}
        revealName
        labelPosition={answer.center}
      />
      {feedback && <FeedbackBadge tone={feedback.tone}>{feedback.label}</FeedbackBadge>}
      <input
        value={value}
        disabled={locked}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="Type the capital..."
        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || locked}
          className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Guess
        </button>
        <button
          type="button"
          onClick={skip}
          disabled={locked}
          className="flex-1 rounded-lg border border-rose-700 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-950 disabled:opacity-40"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
