import type { EarnedAchievement } from '../lib/achievements';

interface AchievementsPanelProps {
  earned: EarnedAchievement[];
}

/** Achievements a finished game earned; new ones (first time, or a higher level) are listed first. */
export function AchievementsPanel({ earned }: AchievementsPanelProps) {
  if (earned.length === 0) return null;

  const sorted = [...earned].sort((a, b) => Number(b.isNew) - Number(a.isNew));

  return (
    <section aria-label="Achievements earned" className="space-y-2 text-left">
      <h3 className="text-center text-sm font-semibold uppercase tracking-wide text-amber-300">
        🏅 {earned.length === 1 ? 'Achievement earned' : `${earned.length} achievements earned`}
      </h3>
      <ul className="space-y-2">
        {sorted.map((a) => (
          <li
            key={a.id}
            className={`flex gap-3 rounded-xl border px-3 py-2 ${
              a.isNew ? 'border-amber-400/50 bg-amber-400/10' : 'border-slate-800 bg-slate-900/60'
            }`}
          >
            <span className="text-2xl" aria-hidden="true">
              {a.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-slate-100">
                {a.name}
                {a.levelLabel && (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-sky-300">
                    {a.levelLabel}
                  </span>
                )}
                {a.isNew && (
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-950">
                    New
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-400">{a.detail ?? a.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
