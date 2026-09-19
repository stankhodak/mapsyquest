interface MoreChallengesScreenProps {
  onBack: () => void;
}

export function MoreChallengesScreen({ onBack }: MoreChallengesScreenProps) {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 text-left text-sm text-slate-300">
      <h2 className="text-xl font-bold text-slate-100">More Challenges</h2>
      <p>More games and leaderboards are on the way — check back soon.</p>
      <button type="button" onClick={onBack} className="text-sm text-slate-400 underline hover:text-slate-200">
        Return to main screen
      </button>
    </div>
  );
}
