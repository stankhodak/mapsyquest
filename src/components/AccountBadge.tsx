import { useEffect, useRef, useState } from 'react';
import { fetchPlayerStats, type PlayerStats } from '../lib/playerStats';

interface AccountBadgeProps {
  displayName: string;
  userId: string;
}

/** Gradient bubble mirroring the Menu button, to the right of the title. Clicking it
 * fetches and shows this account's saved stats — the login/logout action itself stays
 * in the Menu dropdown. */
export function AccountBadge({ displayName, userId }: AccountBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function handleToggle() {
    setIsOpen((prev) => !prev);
    if (stats === null) {
      setIsLoading(true);
      fetchPlayerStats(userId)
        .then(setStats)
        .finally(() => setIsLoading(false));
    }
  }

  return (
    <div ref={containerRef} className="relative min-w-0 max-w-full justify-self-end">
      <button
        type="button"
        onClick={handleToggle}
        title={displayName}
        aria-expanded={isOpen}
        className="block max-w-full truncate rounded-xl bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-3 py-2 text-sm font-bold text-slate-950 shadow-lg transition hover:scale-[1.02] hover:shadow-emerald-500/20 active:scale-[0.98] sm:px-5 sm:py-2.5 sm:text-base"
      >
        {displayName}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-slate-800 to-slate-900 p-4 text-left shadow-xl shadow-emerald-500/10">
          {isLoading && <p className="font-semibold text-slate-200">Loading stats…</p>}

          {!isLoading && stats && (
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-200">Games played</dt>
                <dd className="font-bold text-white">{stats.gamesPlayed}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-200">⭐ Total stars</dt>
                <dd className="font-bold text-white">{stats.totalStars}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-200">🏆 Total points</dt>
                <dd className="font-bold text-white">{stats.totalPoints}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-200">🌟 Best total stars</dt>
                <dd className="font-bold text-white">{stats.bestStars}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-200">💎 Best total points</dt>
                <dd className="font-bold text-white">{stats.bestPoints}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-200">🔥 Current streak</dt>
                <dd className="font-bold text-white">{stats.currentStreak}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-200">Best streak</dt>
                <dd className="font-bold text-white">{stats.maxStreak}</dd>
              </div>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
