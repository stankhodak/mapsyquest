import { useEffect, useState } from 'react';
import { countries, getCountryById } from '../data/countries';
import type { Country } from '../data/types';
import { MAX_SCORE, tierForTry, TRIES_PER_CATEGORY, tryFraction, type StarTier } from '../lib/points';
import { AttemptBadge, RoundBadge } from './Badge';
import { MapScope } from './MapScope';

export interface CapitalGuessResult {
  guess: string;
  score: number;
  isStar: boolean;
  tier: StarTier;
}

/** Everything needed to pick the step up again exactly where it was left. */
export interface CapitalStepState {
  /** The shuffled options, kept so a resumed step shows the same ones in the same places. */
  optionIds: string[];
  wrongIds: string[];
  /** Set the moment the step is decided, so leaving during the reveal pause still finishes it on return. */
  result: CapitalGuessResult | null;
}

interface CapitalStepProps {
  answer: Country;
  roundNumber: number;
  totalRounds: number;
  onComplete: (result: CapitalGuessResult) => void;
  /** Where to resume from, if the step was left part-way. */
  saved?: CapitalStepState | null;
  onStateChange?: (state: CapitalStepState) => void;
}

const MAX_TRIES = TRIES_PER_CATEGORY.capital;
const OPTION_COUNT = 16;
const REVEAL_DELAY_MS = 900;
/** Tighter than the country step's hint margin, so the country fills most of the frame. */
const OUTLINE_PADDING_FRACTION = 0.12;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Distractors favour the answer's own region (same-region capitals are a more
// plausible/harder mix), topped up with capitals from elsewhere if the region
// doesn't have enough other countries (e.g. Oceania).
function buildOptionIds(answer: Country): string[] {
  const rest = countries.filter((c) => c.id !== answer.id);
  const sameRegion = shuffle(rest.filter((c) => c.region === answer.region));
  const otherRegion = shuffle(rest.filter((c) => c.region !== answer.region));
  const distractors = [...sameRegion, ...otherRegion].slice(0, OPTION_COUNT - 1);
  return shuffle([...distractors, answer]).map((c) => c.id);
}

export function CapitalStep({
  answer,
  roundNumber,
  totalRounds,
  onComplete,
  saved = null,
  onStateChange,
}: CapitalStepProps) {
  const [stepState, setStepState] = useState<CapitalStepState>(
    () => saved ?? { optionIds: buildOptionIds(answer), wrongIds: [], result: null },
  );
  const { wrongIds } = stepState;
  const resolved = stepState.result !== null;
  const tryNumber = Math.min(wrongIds.length + 1, MAX_TRIES);
  const options = stepState.optionIds.map(getCountryById).filter((c): c is Country => c !== undefined);

  useEffect(() => {
    onStateChange?.(stepState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepState]);

  // Advances once the answer has been revealed. Cleared on unmount, so leaving mid-pause
  // doesn't complete a step nobody is looking at; it completes on return instead.
  useEffect(() => {
    const result = stepState.result;
    if (!result) return;
    const id = window.setTimeout(() => onComplete(result), REVEAL_DELAY_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepState.result]);

  function pick(option: Country) {
    if (resolved || wrongIds.includes(option.id)) return;

    if (option.id === answer.id) {
      const score = Math.round(MAX_SCORE.capital * tryFraction(tryNumber));
      setStepState((prev) => ({
        ...prev,
        result: { guess: option.capital, score, isStar: true, tier: tierForTry(tryNumber) },
      }));
      return;
    }

    setStepState((prev) => ({
      ...prev,
      wrongIds: [...prev.wrongIds, option.id],
      result: tryNumber >= MAX_TRIES ? { guess: option.capital, score: 0, isStar: false, tier: null } : null,
    }));
  }

  // Skip removed for now — uncomment this function and the button below to restore it.
  // function skip() {
  //   if (locked) return;
  //   setLocked(true);
  //   setResolved(true);
  //   onComplete({ guess: '(skipped)', score: 0, isStar: false, tier: null });
  // }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <RoundBadge>
          Round {roundNumber} of {totalRounds}
        </RoundBadge>
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
        cornerLabel="Guess the capital"
      />
      <div className="grid grid-cols-4 gap-1.5">
        {options.map((option) => {
          const isWrongPick = wrongIds.includes(option.id);
          const isCorrectOption = option.id === answer.id;
          const stateClasses = !resolved
            ? isWrongPick
              ? 'border-rose-500 bg-rose-500/20 text-rose-300 opacity-60'
              : 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'
            : isCorrectOption
              ? 'border-2 border-emerald-400 bg-emerald-500/30 text-slate-100'
              : isWrongPick
                ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                : 'border-slate-700 text-slate-400 opacity-50';

          return (
            <button
              key={option.id}
              type="button"
              disabled={resolved || isWrongPick}
              onClick={() => pick(option)}
              className={`flex min-h-11 items-center justify-center rounded-lg border px-1.5 py-2 text-center text-xs font-medium leading-tight transition ${stateClasses}`}
            >
              {option.capital}
            </button>
          );
        })}
      </div>
      {/* Skip removed for now — uncomment to restore it.
      <button
        type="button"
        onClick={skip}
        disabled={locked}
        className="w-full rounded-lg border border-rose-700 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-950 disabled:opacity-40"
      >
        Skip
      </button>
      */}
    </div>
  );
}
