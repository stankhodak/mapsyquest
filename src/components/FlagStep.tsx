import { useMemo, useState } from 'react';
import { countries } from '../data/countries';
import type { Country } from '../data/types';
import { flagImageUrl } from '../lib/flags';
import { MAX_SCORE, tryFraction } from '../lib/points';

export interface FlagGuessResult {
  guess: string;
  isCorrect: boolean;
  score: number;
}

interface FlagStepProps {
  answer: Country;
  onComplete: (result: FlagGuessResult) => void;
}

const OPTION_COUNT = 10;
const MAX_TRIES = 3;
/** Brief peek at the correct flag after a wrong pick, while tries remain. */
const HINT_FLASH_MS = 500;
/** Longer, fatter highlight once the step truly ends (correct guess, or tries exhausted). */
const FINAL_REVEAL_MS = 900;

type RevealMode = 'none' | 'hint' | 'final';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function FlagStep({ answer, onComplete }: FlagStepProps) {
  const [tryNumber, setTryNumber] = useState(1);
  const [wrongPicks, setWrongPicks] = useState<Set<string>>(new Set());
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  const [revealMode, setRevealMode] = useState<RevealMode>('none');

  // Distractors are plain random picks for now; the instructions doc flags
  // near-neighbour-vs-random difficulty tuning as an open decision.
  const options = useMemo(() => {
    const distractors = shuffle(countries.filter((c) => c.id !== answer.id)).slice(
      0,
      OPTION_COUNT - 1,
    );
    return shuffle([...distractors, answer]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer.id]);

  function pick(id: string) {
    if (revealMode !== 'none' || wrongPicks.has(id)) return;

    if (id === answer.id) {
      const score = Math.round(MAX_SCORE.flag * tryFraction(tryNumber));
      setLastWrong(null);
      setRevealMode('final');
      window.setTimeout(() => onComplete({ guess: id, isCorrect: true, score }), FINAL_REVEAL_MS);
      return;
    }

    setLastWrong(id);
    if (tryNumber >= MAX_TRIES) {
      setWrongPicks((prev) => new Set(prev).add(id));
      setRevealMode('final');
      window.setTimeout(() => onComplete({ guess: id, isCorrect: false, score: 0 }), FINAL_REVEAL_MS);
    } else {
      setRevealMode('hint');
      window.setTimeout(() => {
        setWrongPicks((prev) => new Set(prev).add(id));
        setLastWrong(null);
        setRevealMode('none');
        setTryNumber((t) => t + 1);
      }, HINT_FLASH_MS);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-slate-100">Which flag belongs to {answer.name}?</h2>
      <p className="text-xs text-slate-400">Attempt {tryNumber} of {MAX_TRIES}</p>
      <div className="grid grid-cols-5 gap-2">
        {options.map((c) => {
          const isCorrectOption = c.id === answer.id;
          const isWrongPickShown = c.id === lastWrong && revealMode !== 'none';
          const isDisabledForRetry = wrongPicks.has(c.id) && !isWrongPickShown;

          let stateClasses: string;
          if (revealMode !== 'none' && isCorrectOption) {
            stateClasses =
              revealMode === 'final'
                ? 'border-4 border-emerald-400 bg-emerald-500/30'
                : 'border-emerald-500 bg-emerald-500/20';
          } else if (isWrongPickShown) {
            stateClasses = 'border-rose-500 bg-rose-500/20';
          } else if (isDisabledForRetry) {
            stateClasses = 'border-slate-700 opacity-40';
          } else if (revealMode !== 'none') {
            stateClasses = 'border-slate-700 opacity-60';
          } else {
            stateClasses = 'border-slate-600 bg-slate-800 hover:bg-slate-700';
          }

          return (
            <button
              key={c.id}
              type="button"
              disabled={revealMode !== 'none' || wrongPicks.has(c.id)}
              onClick={() => pick(c.id)}
              className={`flex h-16 items-center justify-center overflow-hidden rounded-lg border p-1 transition ${stateClasses}`}
              aria-label={revealMode !== 'none' ? c.name : 'flag option'}
            >
              <img src={flagImageUrl(c.id)} alt="" className="h-full w-full rounded object-cover" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
