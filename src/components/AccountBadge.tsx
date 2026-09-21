import { useEffect, useRef, useState } from 'react';
import { changeNickname, MAX_NICKNAME_LENGTH } from '../lib/leaderboard';
import { fetchPlayerStats, type PlayerStats } from '../lib/playerStats';

interface AccountBadgeProps {
  displayName: string;
  userId: string;
}

/** Gradient bubble mirroring the Menu button, to the right of the title. Clicking it
 * fetches and shows this account's saved stats, and lets the player change their
 * nickname (Google accounts included) — the login/logout action itself stays in the Menu
 * dropdown. */
export function AccountBadge({ displayName, userId }: AccountBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
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

  // Re-fetched on every open (not cached), so a game finished since the last look shows up.
  function handleToggle() {
    setIsOpen((prev) => !prev);
    setIsRenaming(false);
    if (isOpen) return;
    setIsLoading(true);
    setStatsError(null);
    fetchPlayerStats(userId)
      .then(setStats)
      .catch((error: unknown) => {
        console.error('Loading player stats failed:', error);
        setStatsError(error instanceof Error ? error.message : 'Unknown error');
      })
      .finally(() => setIsLoading(false));
  }

  function startRenaming() {
    setNickname(displayName);
    setRenameError(null);
    setIsRenaming(true);
  }

  async function saveNickname() {
    setIsSaving(true);
    const result = await changeNickname(userId, nickname);
    setIsSaving(false);
    if (!result.ok) {
      setRenameError(result.error);
      return;
    }
    // The header name follows on its own: the account update reaches App as a new session.
    setIsRenaming(false);
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

          {!isLoading && statsError && (
            <p role="alert" className="text-sm text-rose-400">
              Couldn't load your stats: {statsError}
            </p>
          )}

          {!isLoading && !statsError && stats && (
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-200">Games played</dt>
                <dd className="font-bold text-white">{stats.gamesPlayed}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-200">⭐ Best total stars</dt>
                <dd className="font-bold text-white">{stats.bestStars}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-200">🏆 Best total points</dt>
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

          <div className="mt-3 border-t border-slate-700 pt-3">
            {isRenaming ? (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveNickname();
                }}
              >
                <input
                  type="text"
                  autoFocus
                  aria-label="Nickname"
                  maxLength={MAX_NICKNAME_LENGTH}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                {renameError && (
                  <p role="alert" className="text-xs text-rose-400">
                    {renameError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSaving || !nickname.trim()}
                    className="flex-1 rounded-lg bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-3 py-1.5 text-sm font-bold text-slate-950 disabled:opacity-60"
                  >
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsRenaming(false)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={startRenaming}
                className="text-sm font-semibold text-sky-300 hover:text-sky-200"
              >
                ✏️ Change nickname
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
