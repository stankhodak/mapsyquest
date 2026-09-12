import { useMemo, useState } from 'react';
import { countries } from '../data/countries';
import type { Country } from '../data/types';
import { flagImageUrl } from '../lib/flags';
import { MAX_SCORE } from '../lib/points';
import { AttemptBadge } from './Badge';

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
/** Only one attempt — a single wrong flag ends the step, unlike country/capital's 3 tries. */
const REVEAL_DELAY_MS = 900;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function FlagStep({ answer, onComplete }: FlagStepProps) {
  const [selected, setSelected] = useState<string | null>(null);

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
    if (selected) return;
    setSelected(id);
    const isCorrect = id === answer.id;
    const score = isCorrect ? MAX_SCORE.flag : 0;
    window.setTimeout(() => onComplete({ guess: id, isCorrect, score }), REVEAL_DELAY_MS);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-slate-100">Which flag belongs to {answer.name}?</h2>
      <AttemptBadge>Only One Attempt</AttemptBadge>
      <div className="grid grid-cols-5 gap-2">
        {options.map((c) => {
          const isRevealed = selected !== null;
          const isCorrectOption = c.id === answer.id;
          const isPicked = c.id === selected;
          const stateClasses = !isRevealed
            ? 'border-slate-600 bg-slate-800 hover:bg-slate-700'
            : isCorrectOption
              ? 'border-4 border-emerald-400 bg-emerald-500/30'
              : isPicked
                ? 'border-rose-500 bg-rose-500/20'
                : 'border-slate-700 opacity-60';

          return (
            <button
              key={c.id}
              type="button"
              disabled={isRevealed}
              onClick={() => pick(c.id)}
              className={`flex h-16 items-center justify-center overflow-hidden rounded-lg border p-1 transition ${stateClasses}`}
              aria-label={isRevealed ? c.name : 'flag option'}
            >
              <img src={flagImageUrl(c.id)} alt="" className="h-full w-full rounded object-cover" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
