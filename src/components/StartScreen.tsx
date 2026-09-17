import { useEffect, useState } from 'react';
import { track } from '@vercel/analytics/react';
import { msUntilNextDay } from '../lib/daily';
import type { StreakState } from '../lib/storage';
import { MapScope } from './MapScope';

interface StartScreenProps {
  totalRounds: number;
  isLocked: boolean;
  totalStars: number;
  totalPoints: number;
  streak: StreakState;
  onPlay: () => void;
  onViewResults: () => void;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

/** Ticks once a second so the "next challenge in..." countdown on the locked start screen stays live. */
function useCountdownToNextDay(active: boolean): string {
  const [ms, setMs] = useState(() => msUntilNextDay());

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setMs(msUntilNextDay()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  return formatCountdown(ms);
}

const CATEGORY_PILLS = [
  { emoji: '🗺️', label: 'Guess the Country', classes: 'border-sky-500/40 bg-sky-500/15 text-sky-300' },
  { emoji: '🏛️', label: 'Guess the Capital', classes: 'border-violet-500/40 bg-violet-500/15 text-violet-300' },
  { emoji: '🚩', label: 'Guess the Flag', classes: 'border-rose-500/40 bg-rose-500/15 text-rose-300' },
] as const;

export function StartScreen({
  totalRounds,
  isLocked,
  totalStars,
  totalPoints,
  streak,
  onPlay,
  onViewResults,
}: StartScreenProps) {
  const countdown = useCountdownToNextDay(isLocked);

  return (
    <div className="mx-auto w-full max-w-md space-y-6 text-center">
      <MapScope center={{ lat: 15, lng: 10 }} zoom={1.4} countryId="world" showMarker={false} showControls={false} />

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-100">The Daily Geography Challenge</h2>
        <p className="text-sm text-slate-400">
          Guess {totalRounds} countries, their capitals and flags.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {CATEGORY_PILLS.map((pill) => (
          <span
            key={pill.label}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${pill.classes}`}
          >
            {pill.emoji} {pill.label}
          </span>
        ))}
      </div>

      <p className="text-sm font-semibold text-amber-300">
        ⭐ Earn stars &middot; 🏆 Earn points
        {streak.currentStreak > 0 && <> &middot; 🔥 {streak.currentStreak} day streak</>}
      </p>

      {isLocked ? (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">
            You've completed today's challenge — {totalStars} / {totalRounds * 3} stars &middot; {totalPoints}{' '}
            points.
          </p>
          <p className="text-lg font-bold text-emerald-400">Next challenge in {countdown}</p>
          <button
            type="button"
            onClick={onViewResults}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            View today's results
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            // Fired once per browser per day (the day-lock prevents replay), so this
            // event's daily count in the Vercel Analytics dashboard is a reasonable
            // stand-in for "unique players per day" — dev-only, nothing shown in-app.
            track('play_started');
            onPlay();
          }}
          className="w-full rounded-xl bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-6 py-3 text-lg font-bold text-slate-950 shadow-lg transition hover:scale-[1.02] hover:shadow-emerald-500/20 active:scale-[0.98]"
        >
          Play today's challenge
        </button>
      )}
    </div>
  );
}
