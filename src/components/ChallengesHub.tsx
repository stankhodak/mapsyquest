import { useState, type ReactNode } from 'react';
import {
  buildChallengeCountries,
  challengeTitle,
  CHALLENGE_ROUNDS,
  getRegionCountries,
  REGIONS,
  TIME_PENALTY_SECONDS,
  type ChallengeSetup,
  type RegionId,
} from '../lib/challenges';
import type { Country } from '../data/types';
import { ChallengeGame } from './ChallengeGame';
import type { LeaderboardAccount } from './LeaderboardOffer';

interface ChallengesHubProps {
  /** Back to the main start screen. */
  onBack: () => void;
  account: LeaderboardAccount | null;
  onLogin: () => void;
  onViewBoard: (board: string) => void;
}

type HubView = { name: 'menu' } | { name: 'regions' } | { name: 'regional-format'; region: RegionId };

interface ActiveGame {
  setup: ChallengeSetup;
  countries: Country[];
  /** Bumped on "Play again" so the game remounts even when the setup is unchanged. */
  gameId: number;
}

function ChoiceButton({
  onClick,
  emoji,
  title,
  description,
}: {
  onClick: () => void;
  emoji: string;
  title: string;
  description: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-left transition hover:border-slate-500 hover:bg-slate-800 active:scale-[0.98]"
    >
      <span className="text-3xl" aria-hidden="true">
        {emoji}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold text-slate-100">{title}</span>
        <span className="block text-sm text-slate-400">{description}</span>
      </span>
    </button>
  );
}

function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-sm text-slate-400 underline hover:text-slate-200">
      {children}
    </button>
  );
}

export function ChallengesHub({ onBack, account, onLogin, onViewBoard }: ChallengesHubProps) {
  const [view, setView] = useState<HubView>({ name: 'menu' });
  const [game, setGame] = useState<ActiveGame | null>(null);

  function startGame(setup: ChallengeSetup, previousGameId = 0) {
    setGame({ setup, countries: buildChallengeCountries(setup), gameId: previousGameId + 1 });
  }

  if (game) {
    return (
      <ChallengeGame
        key={game.gameId}
        kind={game.setup.kind}
        region={game.setup.region}
        account={account}
        onLogin={onLogin}
        onViewBoard={onViewBoard}
        title={challengeTitle(game.setup)}
        countries={game.countries}
        onPlayAgain={() => startGame(game.setup, game.gameId)}
        onExit={() => {
          setGame(null);
          setView({ name: 'menu' });
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      {view.name === 'menu' && (
        <>
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-bold text-slate-100">More Challenges</h2>
            <p className="text-sm text-slate-400">Practice as often as you like — these don't affect your daily streak.</p>
          </div>
          <ChoiceButton
            onClick={() => setView({ name: 'regions' })}
            emoji="🌍"
            title="Regional Challenge"
            description="Europe, Asia, Americas, Oceania or Islands"
          />
          <ChoiceButton
            onClick={() => startGame({ kind: 'time' })}
            emoji="⏱️"
            title="Time Challenge"
            description={`${CHALLENGE_ROUNDS.time} countries against the clock. Each wrong guess adds ${TIME_PENALTY_SECONDS}s.`}
          />
          <ChoiceButton
            onClick={() => startGame({ kind: 'flag' })}
            emoji="🚩"
            title="Flag Challenge"
            description={`${CHALLENGE_ROUNDS.flag} flags — type the country each one belongs to.`}
          />
          <ChoiceButton
            onClick={() => onViewBoard('daily')}
            emoji="🏆"
            title="Leaderboards"
            description="See how the top players rank."
          />
          <div className="pt-1 text-center">
            <BackLink onClick={onBack}>Return to main screen</BackLink>
          </div>
        </>
      )}

      {view.name === 'regions' && (
        <>
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-bold text-slate-100">Regional Challenge</h2>
            <p className="text-sm text-slate-400">Pick a region.</p>
          </div>
          {REGIONS.map((region) => (
            <ChoiceButton
              key={region.id}
              onClick={() => setView({ name: 'regional-format', region: region.id })}
              emoji={region.emoji}
              title={region.label}
              description={`${getRegionCountries(region.id).length} countries`}
            />
          ))}
          <div className="pt-1 text-center">
            <BackLink onClick={() => setView({ name: 'menu' })}>← Back</BackLink>
          </div>
        </>
      )}

      {view.name === 'regional-format' && (
        <>
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-bold text-slate-100">
              {REGIONS.find((r) => r.id === view.region)?.label}
            </h2>
            <p className="text-sm text-slate-400">Choose how to play.</p>
          </div>
          <ChoiceButton
            onClick={() => startGame({ kind: 'regional-full', region: view.region })}
            emoji="🗺️"
            title="Full Round"
            description={`${CHALLENGE_ROUNDS['regional-full']} countries — guess the country, capital and flag.`}
          />
          <ChoiceButton
            onClick={() => startGame({ kind: 'regional-quiz', region: view.region })}
            emoji="📍"
            title="Country Quiz"
            description={`${CHALLENGE_ROUNDS['regional-quiz']} countries — find each one on the map.`}
          />
          <div className="pt-1 text-center">
            <BackLink onClick={() => setView({ name: 'regions' })}>← Back</BackLink>
          </div>
        </>
      )}
    </div>
  );
}
