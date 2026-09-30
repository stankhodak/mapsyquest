import { useEffect, useRef, useState } from 'react';
import { countries } from '../data/countries';
import type { Country } from '../data/types';
import { flagImageUrl } from '../lib/flags';
import { SKIPPED_GUESS } from '../lib/gameSummaries';
import { MAX_SCORE, tierForTry, TRIES_PER_CATEGORY, tryFraction, type StarTier } from '../lib/points';
import { normaliseCapital } from '../lib/scoring';
import { AttemptBadge, FeedbackBadge, RoundBadge, type FeedbackTone } from './Badge';
import { MapScope } from './MapScope';

export interface CountryGuessResult {
  guess: string;
  isCorrect: boolean;
  score: number;
  tier: StarTier;
}

/** Everything needed to pick the step up again exactly where it was left. */
export interface CountryStepState {
  /** Wrong guesses so far; reported straight away, before the round has finished (e.g. to charge a time penalty). */
  wrongGuesses: number;
  /** Set the moment the step is decided, so leaving during the feedback pause still finishes it on return. */
  result: CountryGuessResult | null;
}

interface CountryStepProps {
  answer: Country;
  roundNumber: number;
  totalRounds: number;
  onComplete: (result: CountryGuessResult) => void;
  /** Where to resume from, if the step was left part-way. */
  saved?: CountryStepState | null;
  onStateChange?: (state: CountryStepState) => void;
  /** What the player identifies the country from: its spot on the map (default) or its flag. */
  clue?: 'map' | 'flag';
}

const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 8;
const MAX_TRIES = TRIES_PER_CATEGORY.country;
/** How long the feedback badge (and MapScope's matching flash) shows before advancing. */
const FEEDBACK_DELAY_MS = 900;

interface Feedback {
  tone: FeedbackTone;
  label: string;
}

export function CountryStep({
  answer,
  roundNumber,
  totalRounds,
  onComplete,
  saved = null,
  onStateChange,
  clue = 'map',
}: CountryStepProps) {
  const [stepState, setStepState] = useState<CountryStepState>(() => saved ?? { wrongGuesses: 0, result: null });
  const [query, setQuery] = useState('');
  const [tryNumber, setTryNumber] = useState(() => Math.min(stepState.wrongGuesses + 1, MAX_TRIES));
  const [flashSignal, setFlashSignal] = useState(0);
  const [flashGuessId, setFlashGuessId] = useState<string | null>(null);
  const [correctFlashSignal, setCorrectFlashSignal] = useState(0);
  const [locked, setLocked] = useState(stepState.result !== null);
  const [feedback, setFeedback] = useState<Feedback | null>(() => feedbackFor(stepState.result));
  const [showPickHint, setShowPickHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hard rule: never autofocus on mobile. Focusing an input there pops the keyboard
  // and yanks the page into a scroll-jump the instant a new round/step opens, before
  // the player has even seen the map — matches the app's own md: breakpoint for
  // "desktop" elsewhere. Desktop keeps the convenience of landing ready to type.
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    onStateChange?.(stepState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepState]);

  // Advances once the feedback has shown. Cleared on unmount, so leaving mid-pause
  // doesn't complete a step nobody is looking at — it completes on return instead.
  useEffect(() => {
    const result = stepState.result;
    if (!result) return;
    const id = window.setTimeout(() => onComplete(result), FEEDBACK_DELAY_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepState.result]);

  const trimmed = query.trim();
  const matches =
    trimmed.length >= MIN_QUERY_LENGTH
      ? countries
          .filter((c) => normaliseCapital(c.name).includes(normaliseCapital(trimmed)))
          .slice(0, MAX_SUGGESTIONS)
      : [];
  // Only real country names count as guesses: free text that doesn't exactly match one
  // (typos, partial names) is refused without using up a try.
  const typedCountry = findCountry(trimmed);

  function submit(name: string) {
    if (locked) return;
    const guessedCountry = findCountry(name);
    if (!guessedCountry) {
      if (name.trim()) setShowPickHint(true);
      return;
    }
    const isCorrect = guessedCountry.id === answer.id;
    setLocked(true);

    if (isCorrect) {
      const score = Math.round(MAX_SCORE.country * tryFraction(tryNumber));
      setFeedback({ tone: 'correct', label: 'Correct!' });
      setCorrectFlashSignal((s) => s + 1);
      setStepState((prev) => ({
        ...prev,
        result: { guess: name, isCorrect: true, score, tier: tierForTry(tryNumber) },
      }));
      return;
    }

    // Flash the actual (wrong) guessed country's outline in red.
    setFlashGuessId(guessedCountry.id);
    setFlashSignal((s) => s + 1);
    setFeedback({ tone: 'wrong', label: 'Nope!' });

    if (tryNumber >= MAX_TRIES) {
      setStepState((prev) => ({
        wrongGuesses: prev.wrongGuesses + 1,
        result: { guess: name, isCorrect: false, score: 0, tier: null },
      }));
    } else {
      setStepState((prev) => ({ ...prev, wrongGuesses: prev.wrongGuesses + 1 }));
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
    onComplete({ guess: SKIPPED_GUESS, isCorrect: false, score: 0, tier: null });
  }

  const onFinalTry = tryNumber >= MAX_TRIES;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <RoundBadge>
          Round {roundNumber} of {totalRounds}
        </RoundBadge>
        <AttemptBadge current={tryNumber} max={MAX_TRIES} />
      </div>
      {clue === 'flag' ? (
        <div className="relative flex h-44 items-end justify-center rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <span className="absolute left-3 top-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Guess the country from its flag
          </span>
          <img
            src={flagImageUrl(answer.id)}
            alt="Flag to identify"
            className="h-28 w-auto max-w-full rounded object-contain shadow-lg"
          />
        </div>
      ) : (
        <MapScope
          center={answer.center}
          zoom={answer.mapZoom}
          countryId={answer.id}
          revealOutline={onFinalTry}
          fitToOutline={onFinalTry}
          flashGuessId={flashGuessId}
          flashSignal={flashSignal}
          correctFlashSignal={correctFlashSignal}
          cornerLabel="Guess the country"
          introGlide
        />
      )}
      {clue === 'map' && onFinalTry && !feedback && (
        <p className="text-xs text-slate-400">Last try — outline revealed on the map</p>
      )}
      {/* Desktop: the feedback badge floats in a slot to the left of the input via
          absolute positioning, so it's out of flow entirely — it can never affect the
          input's width or position, appearing/disappearing has zero effect on anything
          else on screen. Mobile has no room to spare for a floating side slot, so it
          stays inline with Guess/Skip instead (see the button row below) — same badge,
          shown in only one slot at a time. */}
      <div className="relative min-w-0">
        {feedback && (
          <div className="absolute right-full top-1/2 mr-2 hidden -translate-y-1/2 md:block">
            <FeedbackBadge tone={feedback.tone}>{feedback.label}</FeedbackBadge>
          </div>
        )}
        <input
          ref={inputRef}
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
            setShowPickHint(false);
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
      {showPickHint && !locked && matches.length === 0 && (
        <p className="text-xs text-amber-400">Pick a country from the list</p>
      )}
      <div className="flex items-center gap-2">
        {feedback && (
          <div className="shrink-0 md:hidden">
            <FeedbackBadge tone={feedback.tone}>{feedback.label}</FeedbackBadge>
          </div>
        )}
        <button
          type="button"
          onClick={() => submit(query)}
          disabled={!typedCountry || locked}
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

function feedbackFor(result: CountryGuessResult | null): Feedback | null {
  if (!result) return null;
  return result.isCorrect ? { tone: 'correct', label: 'Correct!' } : { tone: 'wrong', label: 'Nope!' };
}

function findCountry(name: string): Country | undefined {
  const normalised = normaliseCapital(name);
  if (!normalised) return undefined;
  return countries.find((c) => normaliseCapital(c.name) === normalised);
}
