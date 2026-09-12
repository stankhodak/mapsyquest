import type { ReactNode } from 'react';

export function RoundBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-800 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-slate-300">
      {children}
    </span>
  );
}

export function AttemptBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-800 px-4 py-1.5 text-base font-extrabold text-slate-100">
      {children}
    </span>
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
      className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wide ${FEEDBACK_TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
