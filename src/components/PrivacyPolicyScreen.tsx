interface PrivacyPolicyScreenProps {
  onBack: () => void;
}

export function PrivacyPolicyScreen({ onBack }: PrivacyPolicyScreenProps) {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 text-left text-sm text-slate-300">
      <h2 className="text-xl font-bold text-slate-100">Privacy Policy</h2>

      <p>
        You can play without an account — nothing here is required to enjoy the daily challenge.
      </p>
      <p>
        If you choose to log in with Google or an email/password, that's handled by Supabase, a third-party
        authentication provider. We store the email address you sign up with, and if you use Google, whatever
        basic profile info it shares (name and profile photo). Logging in doesn't currently change how the game
        works — your daily progress and streak still live only in your browser's local storage, not tied to your
        account.
      </p>
      <p>
        We use Vercel Web Analytics to see anonymous, aggregate usage (like how many people started a game). It
        doesn't use cookies and doesn't track you individually across sites.
      </p>
      <p>
        Clearing your browser's site data removes your local progress and streak permanently — that's separate
        from any account you've created. To have your account and its data deleted, message us through the{' '}
        <a
          href="https://ko-fi.com/gamesbonds"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-300 underline hover:text-emerald-200"
        >
          Donate page
        </a>{' '}
        and we'll take care of it.
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
