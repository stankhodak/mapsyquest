import { useEffect, useRef, useState } from 'react';

interface MenuDropdownProps {
  onPrivacyPolicy: () => void;
}

/** Bubble menu to the left of the title. Login/Donate are placeholders for now — only Privacy Policy is wired up. */
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
        className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
      >
        Menu
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-10 mt-2 w-44 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-left shadow-lg">
          <button
            type="button"
            disabled
            className="block w-full cursor-not-allowed px-4 py-2 text-sm text-slate-600"
          >
            Login
          </button>
          <button
            type="button"
            disabled
            className="block w-full cursor-not-allowed px-4 py-2 text-sm text-slate-600"
          >
            Donate
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onPrivacyPolicy();
            }}
            className="block w-full px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Privacy Policy
          </button>
        </div>
      )}
    </div>
  );
}
