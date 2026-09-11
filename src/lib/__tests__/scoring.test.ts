import { describe, expect, it } from 'vitest';
import { levenshtein, normaliseCapital, scoreCapitalGuess } from '../scoring';

describe('normaliseCapital', () => {
  it('collapses hyphenated and spaced variants to the same string', () => {
    expect(normaliseCapital('Port-au-Prince')).toBe('port au prince');
    expect(normaliseCapital('Port au Prince')).toBe('port au prince');
  });

  it('collapses punctuated and unpunctuated variants to the same string', () => {
    expect(normaliseCapital('Washington D.C.')).toBe('washington dc');
    expect(normaliseCapital('Washington DC')).toBe('washington dc');
  });

  it('strips accents', () => {
    expect(normaliseCapital('Bogotá')).toBe('bogota');
    expect(normaliseCapital('Bogota')).toBe('bogota');
  });

  it('strips apostrophes', () => {
    expect(normaliseCapital("N'Djamena")).toBe('ndjamena');
  });
});

describe('levenshtein', () => {
  it('is 0 for identical strings', () => {
    expect(levenshtein('paris', 'paris')).toBe(0);
  });

  it('counts a single substitution as distance 1', () => {
    expect(levenshtein('paris', 'pariz')).toBe(1);
  });

  it('counts a single insertion as distance 1', () => {
    expect(levenshtein('paris', 'pariis')).toBe(1);
  });
});

describe('scoreCapitalGuess', () => {
  it('scores an exact match as 100 and a star', () => {
    const result = scoreCapitalGuess('Paris', 'Paris');
    expect(result.score).toBe(100);
    expect(result.isStar).toBe(true);
  });

  it('treats differently-formatted-but-correct answers as 100, not a near-miss', () => {
    expect(scoreCapitalGuess('Port-au-Prince', 'Port au Prince').score).toBe(100);
    expect(scoreCapitalGuess('Washington D.C.', 'Washington DC').score).toBe(100);
    expect(scoreCapitalGuess('Bogotá', 'Bogota').score).toBe(100);
  });

  describe('short-name length adjustment', () => {
    // Without a minimum-length floor on the denominator, a single edit on a 5-letter
    // word like "Paris" would score 80 (1 - 1/5). The floor (denominator of at least
    // 6) softens this to a friendlier ~83, per the "known limitation to solve during
    // build" note in geo-game-instructions.md.
    it('is more forgiving than raw Levenshtein for a one-character typo', () => {
      const misspelledInsertion = scoreCapitalGuess('Pariis', 'Paris'); // insertion
      const misspelledSubstitution = scoreCapitalGuess('Pariz', 'Paris'); // substitution
      expect(misspelledInsertion.score).toBe(83);
      expect(misspelledSubstitution.score).toBe(83);
      expect(misspelledInsertion.score).toBeGreaterThan(80);
    });

    it('has little effect on longer names where the natural length already exceeds the floor', () => {
      // "Buenos Aire" vs "Buenos Aires": distance 1, natural length 12 > floor of 6,
      // so the floor does not kick in and this scores close to the raw ~92%.
      const result = scoreCapitalGuess('Buenos Aire', 'Buenos Aires');
      expect(result.score).toBe(92);
      expect(result.isStar).toBe(false);
    });
  });

  describe('thresholds', () => {
    it('scores exactly 60% similarity as a non-zero pass', () => {
      // Equal-length 10-char strings differing in exactly 4 positions:
      // similarity = 1 - 4/10 = 0.6
      const result = scoreCapitalGuess('abcdefZZZZ', 'abcdefghij');
      expect(result.score).toBe(60);
      expect(result.isStar).toBe(false);
    });

    it('scores below 60% similarity as 0 (wrong)', () => {
      // Equal-length 10-char strings differing in exactly 5 positions:
      // similarity = 1 - 5/10 = 0.5, below the 60% floor.
      const result = scoreCapitalGuess('abcdeZZZZZ', 'abcdefghij');
      expect(result.score).toBe(0);
      expect(result.isStar).toBe(false);
    });

    it('awards a star at exactly 95% similarity', () => {
      // Equal-length 20-char strings differing in exactly 1 position:
      // similarity = 1 - 1/20 = 0.95
      const answer = 'abcdefghijklmnopqrst';
      const guess = 'abcdefghijklmnopqrsZ';
      const result = scoreCapitalGuess(guess, answer);
      expect(result.score).toBe(95);
      expect(result.isStar).toBe(true);
    });

    it('does not award a star just below 95% similarity', () => {
      // Equal-length 20-char strings differing in exactly 2 positions:
      // similarity = 1 - 2/20 = 0.9
      const answer = 'abcdefghijklmnopqrst';
      const guess = 'abcdefghijklmnopqrZZ';
      const result = scoreCapitalGuess(guess, answer);
      expect(result.score).toBe(90);
      expect(result.isStar).toBe(false);
    });
  });

  it('handles an empty guess without throwing', () => {
    const result = scoreCapitalGuess('', 'Paris');
    expect(result.score).toBe(0);
    expect(result.isStar).toBe(false);
  });
});
