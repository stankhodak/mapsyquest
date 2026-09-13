import type { ReactNode } from 'react';

export function RoundBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-800 px-4 py-1.5 text-base font-extrabold text-slate-100">
      {children}
    </span>
  );
}

type AttemptTone = 'green' | 'yellow' | 'red';

const ATTEMPT_TONE_CLASSES: Record<AttemptTone, string> = {
  green: 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-100',
  yellow: 'border border-amber-500/40 bg-amber-500/20 text-amber-100',
  red: 'border border-rose-500/40 bg-rose-500/20 text-rose-100',
};

function deriveAttemptTone(current: number): AttemptTone {
  if (current >= 3) return 'red';
  if (current === 2) return 'yellow';
  return 'green';
}

interface AttemptBadgeProps {
  current: number;
  max: number;
  /** Overrides the derived (1=green/2=yellow/3=red) tone — used by the flag step's single, "last chance" attempt. */
  tone?: AttemptTone;
  /** Overrides the default "Attempt {current} of {max}" text. */
  label?: string;
}

export function AttemptBadge({ current, max, tone, label }: AttemptBadgeProps) {
  const resolvedTone = tone ?? deriveAttemptTone(current);
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-4 py-1.5 text-base font-extrabold ${ATTEMPT_TONE_CLASSES[resolvedTone]}`}
    >
      {label ?? `Attempt ${current} of ${max}`}
    </span>
  );
}

export function QuestionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="min-w-0 truncate rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-1.5 text-base font-medium text-slate-100">
      {children}
    </h2>
  );
}

export type FeedbackTone = 'correct' | 'close' | 'wrong';

const FEEDBACK_TONE_CLASSES: Record<FeedbackTone, string> = {
  correct: 'bg-emerald-600 text-white',
  close: 'bg-amber-500 text-slate-950',
  wrong: 'bg-rose-600 text-white',
};

export function FeedbackBadge({ tone, children }: { tone: FeedbackTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wide ${FEEDBACK_TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
