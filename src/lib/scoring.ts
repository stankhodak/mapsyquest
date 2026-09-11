/**
 * Capital-name scoring, per the "Capital scoring" spec in geo-game-instructions.md.
 */

/** Below this similarity, a guess counts as wrong and scores 0. */
const WRONG_THRESHOLD = 0.6;
/** At or above this similarity, a guess counts as a full/star-worthy correct guess. */
const STAR_THRESHOLD = 0.95;

/**
 * Minimum denominator used when converting Levenshtein distance to a similarity
 * ratio. Without this floor, short capital names are punished disproportionately
 * (a single-character swap on a 5-letter word like "Paris" is a 20% hit). This is
 * the "minimum-length floor" fix flagged as the known limitation to resolve in the
 * instructions doc, chosen over a post-hoc curve for simplicity and predictability.
 */
const MIN_LENGTH_DENOMINATOR = 6;

/** Lowercase, strip accents, strip cosmetic punctuation. */
function stripAccentsAndPunctuation(input: string): string {
  const noAccents = input.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return noAccents.toLowerCase().replace(/[.,'’]/g, '');
}

/** Hyphens -> spaces, collapse whitespace, trim. */
function canonicaliseSpacing(input: string): string {
  return input.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normaliseCapital(input: string): string {
  return canonicaliseSpacing(stripAccentsAndPunctuation(input));
}

/** Standard iterative Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  let currRow = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost, // substitution
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[n];
}

export interface CapitalScoreResult {
  /** 0-100 */
  score: number;
  /** True when the guess earns full star credit (score derived from >=95% similarity). */
  isStar: boolean;
  normalisedGuess: string;
  normalisedAnswer: string;
}

export function scoreCapitalGuess(guess: string, answer: string): CapitalScoreResult {
  const normalisedGuess = normaliseCapital(guess);
  const normalisedAnswer = normaliseCapital(answer);

  if (normalisedGuess.length > 0 && normalisedGuess === normalisedAnswer) {
    return { score: 100, isStar: true, normalisedGuess, normalisedAnswer };
  }

  const distance = levenshtein(normalisedGuess, normalisedAnswer);
  const denominator = Math.max(
    normalisedGuess.length,
    normalisedAnswer.length,
    MIN_LENGTH_DENOMINATOR,
  );
  const similarity = 1 - distance / denominator;

  if (similarity < WRONG_THRESHOLD) {
    return { score: 0, isStar: false, normalisedGuess, normalisedAnswer };
  }

  const score = Math.max(0, Math.min(100, Math.round(similarity * 100)));
  return { score, isStar: similarity >= STAR_THRESHOLD, normalisedGuess, normalisedAnswer };
}
