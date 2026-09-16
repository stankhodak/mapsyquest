interface PrivacyPolicyScreenProps {
  onBack: () => void;
}

export function PrivacyPolicyScreen({ onBack }: PrivacyPolicyScreenProps) {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 text-left text-sm text-slate-300">
      <h2 className="text-xl font-bold text-slate-100">Privacy Policy</h2>

      <p>
        MapsyQuest doesn't have accounts or a backend. Your daily progress and streak are stored only in your
        browser's local storage, on your device — they're never sent to us or anyone else.
      </p>
      <p>
        We use Vercel Web Analytics to see anonymous, aggregate usage (like how many people started a game). It
        doesn't use cookies and doesn't track you individually across sites.
      </p>
      <p>
        Clearing your browser's site data for MapsyQuest removes your saved progress and streak permanently.
      </p>

      <button
        type="button"
        onClick={onBack}
        className="text-sm text-slate-400 underline hover:text-slate-200"
      >
        Return to main screen
      </button>
    </div>
  );
}
