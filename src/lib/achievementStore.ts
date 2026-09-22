/**
 * Saves the achievement profile in localStorage, same client-side approach (and
 * try/catch caution) as the streak in storage.ts. Nothing here is sent to a server.
 */
import {
  createEmptyProfile,
  evaluateGame,
  type AchievementProfile,
  type EvaluationResult,
  type GameSummary,
} from './achievements';
import { safeGetItem, safeSetItem, scopedKey, type StorageOwner } from './storage';

const profileKey = (owner: StorageOwner) => scopedKey('achievements', owner);

export function loadAchievementProfile(owner: StorageOwner = null): AchievementProfile {
  const raw = safeGetItem(profileKey(owner));
  if (!raw) return createEmptyProfile();
  try {
    // Spread over the empty profile so a record saved by an older version, missing newer fields, still loads.
    return { ...createEmptyProfile(), ...(JSON.parse(raw) as Partial<AchievementProfile>) };
  } catch {
    return createEmptyProfile();
  }
}

export function saveAchievementProfile(profile: AchievementProfile, owner: StorageOwner = null): void {
  safeSetItem(profileKey(owner), JSON.stringify(profile));
}

/**
 * Evaluates a finished game against the saved profile, saves the updated profile and
 * returns what was earned. Call once per game.
 */
export function recordGame(game: GameSummary, dailyStreak = 0, owner: StorageOwner = null): EvaluationResult {
  const result = evaluateGame(game, loadAchievementProfile(owner), dailyStreak);
  saveAchievementProfile(result.profile, owner);
  return result;
}
