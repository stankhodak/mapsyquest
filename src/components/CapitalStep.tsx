import { useMemo, useState } from 'react';
import { countries } from '../data/countries';
import type { Country } from '../data/types';
import { MAX_SCORE, tierForTry, tryFraction, type StarTier } from '../lib/points';
import { AttemptBadge, RoundBadge } from './Badge';
import { MapScope } from './MapScope';

export interface CapitalGuessResult {
  guess: string;
  score: number;
  isStar: boolean;
  tier: StarTier;
}

interface CapitalStepProps {
  answer: Country;
  roundNumber: number;
  totalRounds: number;
  onComplete: (result: CapitalGuessResult) => void;
}

const MAX_TRIES = 2;
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

export function CapitalStep({ answer, roundNumber, totalRounds, onComplete }: CapitalStepProps) {
  const [tryNumber, setTryNumber] = useState(1);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [resolved, setResolved] = useState(false);
  const [locked, setLocked] = useState(false);

  // Distractors favour the answer's own region (same-region capitals are a more
  // plausible/harder mix), topped up with capitals from elsewhere if the region
  // doesn't have enough other countries (e.g. Oceania).
  const options = useMemo(() => {
    const rest = countries.filter((c) => c.id !== answer.id);
    const sameRegion = shuffle(rest.filter((c) => c.region === answer.region));
    const otherRegion = shuffle(rest.filter((c) => c.region !== answer.region));
    const distractors = [...sameRegion, ...otherRegion].slice(0, OPTION_COUNT - 1);
    return shuffle([...distractors, answer]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer.id]);

  function pick(option: Country) {
    if (locked || wrongIds.includes(option.id)) return;

    if (option.id === answer.id) {
      setLocked(true);
      setResolved(true);
      const score = Math.round(MAX_SCORE.capital * tryFraction(tryNumber));
      window.setTimeout(
        () => onComplete({ guess: option.capital, score, isStar: true, tier: tierForTry(tryNumber) }),
        REVEAL_DELAY_MS,
      );
      return;
    }

    if (tryNumber >= MAX_TRIES) {
      setLocked(true);
      setResolved(true);
      setWrongIds((prev) => [...prev, option.id]);
      window.setTimeout(
        () => onComplete({ guess: option.capital, score: 0, isStar: false, tier: null }),
        REVEAL_DELAY_MS,
      );
      return;
    }

    setWrongIds((prev) => [...prev, option.id]);
    setTryNumber((t) => t + 1);
  }

  function skip() {
    if (locked) return;
    setLocked(true);
    setResolved(true);
    onComplete({ guess: '(skipped)', score: 0, isStar: false, tier: null });
  }

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
      <button
        type="button"
        onClick={skip}
        disabled={locked}
        className="w-full rounded-lg border border-rose-700 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-950 disabled:opacity-40"
      >
        Skip
      </button>
    </div>
  );
}
