import type { ReactNode } from 'react';
import { ACHIEVEMENTS, type AchievementDef } from '../lib/achievements';
import { CHALLENGE_ROUNDS, TIME_PENALTY_SECONDS, wrongGuessesForTier } from '../lib/challenges';
import {
  MAX_SCORE,
  starMultiplier,
  tierForTry,
  tierIcon,
  TRIES_PER_CATEGORY,
  tryFraction,
  type ScoringCategory,
} from '../lib/points';

interface ScoringGuideScreenProps {
  onBack: () => void;
}

// Everything numeric on this screen is computed from the same constants the game uses,
// so the guide can't drift out of date when a score or threshold is tuned.

const DAILY_ROUNDS = CHALLENGE_ROUNDS['regional-full'];
const CATEGORIES: { key: ScoringCategory; label: string }[] = [
  { key: 'country', label: 'Country' },
  { key: 'capital', label: 'Capital' },
  { key: 'flag', label: 'Flag' },
];

/** Points for getting a category right on the given try. */
function pointsForTry(category: ScoringCategory, tryNumber: number): number {
  return Math.round(MAX_SCORE[category] * tryFraction(tryNumber));
}

const MAX_ROUND_BASE = CATEGORIES.reduce((sum, c) => sum + MAX_SCORE[c.key], 0);
const MAX_ROUND_POINTS = MAX_ROUND_BASE * starMultiplier(3);
const MAX_DAY_POINTS = MAX_ROUND_POINTS * DAILY_ROUNDS;

// Worked example: country on the 2nd try, capital first try, flag missed.
const EXAMPLE_COUNTRY = pointsForTry('country', 2);
const EXAMPLE_CAPITAL = pointsForTry('capital', 1);
const EXAMPLE_FLAG = 0;
const EXAMPLE_STARS = 2;
const EXAMPLE_TOTAL = Math.round((EXAMPLE_COUNTRY + EXAMPLE_CAPITAL + EXAMPLE_FLAG) * starMultiplier(EXAMPLE_STARS));

const fmt = (n: number) => n.toLocaleString();

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-slate-800 py-1.5 first:border-t-0">
      <span className="text-slate-200">{label}</span>
      <span className="text-right text-slate-300">{children}</span>
    </div>
  );
}

function AchievementRow({ def }: { def: AchievementDef }) {
  return (
    <li className="space-y-0.5 border-t border-slate-800 py-2 first:border-t-0">
      <p className="font-semibold text-slate-100">
        <span aria-hidden="true">{def.emoji}</span> {def.name}
      </p>
      <p className="text-slate-400">{def.description}</p>
      {def.levels && (
        <p className="text-xs text-slate-500">Levels: {def.levels.map((l) => l.label).join(' · ')}</p>
      )}
    </li>
  );
}

export function ScoringGuideScreen({ onBack }: ScoringGuideScreenProps) {
  const inGame = ACHIEVEMENTS.filter((a) => a.scope === 'game');
  const overTime = ACHIEVEMENTS.filter((a) => a.scope === 'lifetime');

  return (
    <div className="mx-auto w-full max-w-md space-y-4 text-left text-sm text-slate-300">
      <div>
        <h2 className="text-xl font-bold text-slate-100">How scoring works</h2>
        <p className="text-slate-400">Every number the game awards, and where it comes from.</p>
      </div>

      <Section title="Points for each step">
        <p>
          A round has three steps. Getting a step right earns points, and the sooner you get it right the more it is
          worth.
        </p>
        <div>
          {CATEGORIES.map(({ key, label }) => {
            const tries = TRIES_PER_CATEGORY[key];
            const values = Array.from({ length: tries }, (_, i) => pointsForTry(key, i + 1));
            return (
              <Row key={key} label={`${label} · ${tries} ${tries === 1 ? 'try' : 'tries'}`}>
                {values.map(fmt).join(' / ')} pts
              </Row>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">
          Country is typed in, and capital and flag are picked from options. Each try lowers the points; a miss or
          skip earns nothing.
        </p>
      </Section>

      <Section title="Medals">
        <p>
          Each step also earns a medal for the try you got it on: {tierIcon(tierForTry(1))} first try,{' '}
          {tierIcon(tierForTry(2))} second, {tierIcon(tierForTry(3))} third, {tierIcon(null)} missed. Medals don't
          change your points, but they drive the Gold Standard and First Try achievements.
        </p>
      </Section>

      <Section title="Stars and the round multiplier">
        <p>
          Every step you get right earns a ⭐, whichever try it took. Add up the step points, then multiply by the
          number of stars:
        </p>
        <div>
          {[0, 1, 2, 3].map((stars) => (
            <Row key={stars} label={stars === 0 ? 'No stars' : '⭐'.repeat(stars)}>
              ×{starMultiplier(stars)}
            </Row>
          ))}
        </div>
        <p className="rounded-lg bg-slate-800/70 p-3">
          <span className="font-semibold text-slate-100">Example: </span>
          country on the 2nd try ({EXAMPLE_COUNTRY}) + capital on the 1st try ({EXAMPLE_CAPITAL}) + flag missed (
          {EXAMPLE_FLAG}) = {fmt(EXAMPLE_COUNTRY + EXAMPLE_CAPITAL + EXAMPLE_FLAG)}. That's {EXAMPLE_STARS} stars, so
          ×{starMultiplier(EXAMPLE_STARS)} = <span className="font-semibold text-emerald-400">{fmt(EXAMPLE_TOTAL)}</span>{' '}
          points for the round.
        </p>
        <p>
          A perfect round is worth {fmt(MAX_ROUND_BASE)} × {starMultiplier(3)} ={' '}
          <span className="font-semibold text-emerald-400">{fmt(MAX_ROUND_POINTS)}</span>, so a perfect{' '}
          {DAILY_ROUNDS}-round day is <span className="font-semibold text-emerald-400">{fmt(MAX_DAY_POINTS)}</span>.
        </p>
      </Section>

      <Section title="The daily challenge and Full Rounds">
        <p>
          The daily challenge is {DAILY_ROUNDS} rounds scored exactly as above, and it's the only game that counts
          towards your streak. A regional <span className="font-semibold text-slate-100">Full Round</span> plays the
          same way with {DAILY_ROUNDS} countries from the region you pick.
        </p>
      </Section>

      <Section title="Country Quiz and Flag Challenge">
        <p>
          Only the country step is played: {CHALLENGE_ROUNDS['regional-quiz']} countries found on the map (Regional
          Country Quiz), or {CHALLENGE_ROUNDS.flag} flags to name (Flag Challenge). Each is worth{' '}
          {Array.from({ length: TRIES_PER_CATEGORY.country }, (_, i) => pointsForTry('country', i + 1)).join(' / ')}{' '}
          points by try, with no star multiplier, so the most you can score is{' '}
          {fmt(MAX_SCORE.country * CHALLENGE_ROUNDS['regional-quiz'])}.
        </p>
      </Section>

      <Section title="Time Challenge">
        <p>
          No points here, just your time. The clock runs from the first country to the last, and every wrong guess
          adds {TIME_PENALTY_SECONDS} seconds:
        </p>
        <div>
          {(['gold', 'silver', 'bronze', null] as const).map((tier) => {
            const wrong = wrongGuessesForTier(tier);
            return (
              <Row key={String(tier)} label={`${tierIcon(tier)} ${tier === null ? 'Missed or skipped' : `Right on try ${tier === 'gold' ? 1 : tier === 'silver' ? 2 : 3}`}`}>
                {wrong === 0 ? 'no penalty' : `+${wrong * TIME_PENALTY_SECONDS}s`}
              </Row>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">Your final time is the clock time plus all penalties. Lower is better.</p>
      </Section>

      <Section title="Achievements earned in a game">
        <p>These appear at the end of a game that earns them.</p>
        <ul>
          {inGame.map((def) => (
            <AchievementRow key={def.id} def={def} />
          ))}
        </ul>
      </Section>

      <Section title="Achievements earned over time">
        <p>These build up across all the games you play, and show when you reach a new level.</p>
        <ul>
          {overTime.map((def) => (
            <AchievementRow key={def.id} def={def} />
          ))}
        </ul>
      </Section>

      <button type="button" onClick={onBack} className="text-sm text-slate-400 underline hover:text-slate-200">
        Return to main screen
      </button>
    </div>
  );
}
