import { useMemo, useState } from 'react';
import { countries } from '../data/countries';
import type { Country } from '../data/types';
import { flagEmoji } from '../lib/flags';

export interface FlagGuessResult {
  guess: string;
  isCorrect: boolean;
  elapsedMs: number;
}

interface FlagStepProps {
  answer: Country;
  onComplete: (result: FlagGuessResult) => void;
}

const OPTION_COUNT = 10;
const REVEAL_DELAY_MS = 500;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function FlagStep({ answer, onComplete }: FlagStepProps) {
  const [startTime] = useState(() => Date.now());
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

  function submit(id: string) {
    if (selected) return;
    setSelected(id);
    const isCorrect = id === answer.id;
    window.setTimeout(() => {
      onComplete({ guess: id, isCorrect, elapsedMs: Date.now() - startTime });
    }, REVEAL_DELAY_MS);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-slate-100">Which flag belongs to {answer.name}?</h2>
      <div className="grid grid-cols-5 gap-2">
        {options.map((c) => {
          const isRevealed = selected !== null;
          const isCorrectOption = c.id === answer.id;
          const isPicked = c.id === selected;
          const stateClasses = !isRevealed
            ? 'border-slate-600 bg-slate-800 hover:bg-slate-700'
            : isCorrectOption
              ? 'border-emerald-500 bg-emerald-500/20'
              : isPicked
                ? 'border-rose-500 bg-rose-500/20'
                : 'border-slate-700 opacity-60';

          return (
            <button
              key={c.id}
              type="button"
              disabled={isRevealed}
              onClick={() => submit(c.id)}
              className={`flex h-16 items-center justify-center rounded-lg border text-3xl transition ${stateClasses}`}
              aria-label={isRevealed ? c.name : 'flag option'}
            >
              {flagEmoji(c.id)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
