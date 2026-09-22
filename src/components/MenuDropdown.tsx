import { useEffect, useRef, useState } from 'react';

interface MenuDropdownProps {
  onMoreChallenges: () => void;
  onPrivacyPolicy: () => void;
  onScoringGuide: () => void;
  onLeaderboards: () => void;
  onLoginClick: () => void;
  onLogout: () => void;
  /** Signed-in user's email, or null when logged out. */
  userEmail: string | null;
}

const DONATE_URL = 'https://ko-fi.com/gamesbonds';

/** Bubble menu to the left of the title. */
export function MenuDropdown({
  onMoreChallenges,
  onPrivacyPolicy,
  onScoringGuide,
  onLeaderboards,
  onLoginClick,
  onLogout,
  userEmail,
}: MenuDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div ref={containerRef} className="relative justify-self-start">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="rounded-xl bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-3 py-2 text-sm font-bold text-slate-950 shadow-lg transition hover:scale-[1.02] hover:shadow-emerald-500/20 active:scale-[0.98] sm:px-5 sm:py-2.5 sm:text-base"
      >
        Menu
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-10 mt-2 w-48 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-slate-800 to-slate-900 text-left shadow-xl shadow-emerald-500/10">
          {userEmail && (
            <p className="truncate px-4 pt-2.5 text-xs text-slate-500" title={userEmail}>
              Signed in as {userEmail}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onMoreChallenges();
            }}
            className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200 ${userEmail ? 'border-t border-slate-700/60' : ''}`}
          >
            <span>🧭</span> More Challenges
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onLeaderboards();
            }}
            className="flex w-full items-center gap-2 border-t border-slate-700/60 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <span>🏆</span> Leaderboards
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onScoringGuide();
            }}
            className="flex w-full items-center gap-2 border-t border-slate-700/60 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <span>📖</span> How scoring works
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onPrivacyPolicy();
            }}
            className="flex w-full items-center gap-2 border-t border-slate-700/60 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <span>📄</span> Privacy Policy
          </button>
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2 border-t border-slate-700/60 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <span>💖</span> Donate
          </a>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              if (userEmail) onLogout();
              else onLoginClick();
            }}
            className="flex w-full items-center gap-2 border-t border-slate-700/60 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <span>🔑</span> {userEmail ? 'Log out' : 'Login'}
          </button>
        </div>
      )}
    </div>
  );
}
