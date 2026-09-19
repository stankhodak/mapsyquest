interface LeaderboardOfferProps {
  isSignedIn: boolean;
  onLogin: () => void;
}

/**
 * Where the "add my score to the leaderboard" offer lives. Leaderboards aren't live
 * yet, so for now this only tells the player what's coming (and nudges guests to log
 * in, which posting will need). Swap the body for a real button once scores can be saved.
 */
export function LeaderboardOffer({ isSignedIn, onLogin }: LeaderboardOfferProps) {
  return (
    <section
      aria-label="Leaderboard"
      className="space-y-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-center"
    >
      <p className="text-sm font-bold text-sky-200">🏆 Leaderboards are coming soon</p>
      {isSignedIn ? (
        <p className="text-xs text-slate-400">You're logged in, so you'll be able to post scores like this one.</p>
      ) : (
        <>
          <p className="text-xs text-slate-400">Log in now so you're ready to post your scores when they open.</p>
          <button
            type="button"
            onClick={onLogin}
            className="rounded-lg border border-sky-500/60 px-3 py-1.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
          >
            Log in
          </button>
        </>
      )}
    </section>
  );
}
