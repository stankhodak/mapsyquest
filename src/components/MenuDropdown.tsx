import { useEffect, useRef, useState } from 'react';

interface MenuDropdownProps {
  onPrivacyPolicy: () => void;
}

const DONATE_URL = 'https://ko-fi.com/gamesbonds';

/** Bubble menu to the left of the title. Login is a placeholder for now — Donate and Privacy Policy are wired up. */
export function MenuDropdown({ onPrivacyPolicy }: MenuDropdownProps) {
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
        className="rounded-xl bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-5 py-2.5 text-base font-bold text-slate-950 shadow-lg transition hover:scale-[1.02] hover:shadow-emerald-500/20 active:scale-[0.98]"
      >
        Menu
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-10 mt-2 w-48 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-slate-800 to-slate-900 text-left shadow-xl shadow-emerald-500/10">
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-2 px-4 py-2.5 text-sm text-slate-600"
          >
            <span>🔑</span> Login
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
              onPrivacyPolicy();
            }}
            className="flex w-full items-center gap-2 border-t border-slate-700/60 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <span>📄</span> Privacy Policy
          </button>
        </div>
      )}
    </div>
  );
}
