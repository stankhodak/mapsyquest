interface CookieConsentBannerProps {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onPrivacyPolicy: () => void;
}

/** Shown once, on a visitor's first load, until they choose. Quick choices only — see
 * PrivacyPolicyScreen's Cookies section for the per-category breakdown and to change
 * a choice later. */
export function CookieConsentBanner({ onAcceptAll, onRejectAll, onPrivacyPolicy }: CookieConsentBannerProps) {
  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 text-center text-sm text-slate-300 sm:flex-row sm:justify-between sm:text-left">
        <p>
          We use optional cookies for our own analytics, off until you say yes. See our{' '}
          <button type="button" onClick={onPrivacyPolicy} className="text-emerald-300 underline hover:text-emerald-200">
            Privacy Policy
          </button>{' '}
          for the full breakdown and to manage this later.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRejectAll}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            Necessary only
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className="rounded-lg bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 shadow transition hover:scale-[1.05] active:scale-[0.95]"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
