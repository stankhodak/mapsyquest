# Project: Daily Geography Guessing Game

## Concept

A daily web game in the spirit of maptag.gg and whereabouts.earth/daily, but with its own map (not a duplicate/reuse of either site's map assets or exact mechanic). No country borders shown by default. Player is shown a location scope (zoomed to a country and its capital) and has to correctly identify three things about it, in a fixed order.

## Core Round Structure

Each round covers one country. Order of guesses within a round:

1. **Country name** — free text input with a dropdown of matches. Dropdown should not surface matches until at least 3 characters are typed, and should not visually highlight the exact match, to avoid trivialising the guess.
2. **Capital name** — free text input, no clues or hints. Scored by string closeness (see Scoring below), not pass/fail.
3. **Flag** — multiple choice, correct flag among 10 options shown.

Rationale for this order: country must be known before capital can be meaningfully scored/contextualised, and flag works well as a quick, light closer.

### Small-country fallback

Some countries have very few settlements (e.g. Liechtenstein has around 3 towns of any size). For these, don't attempt a pin-then-list capital mechanic — for capital guessing generally we're using free text, so this is less of an issue than originally scoped, but keep an eye on any country-count-dependent mechanic (e.g. if a "list of cities in the country" multiple-choice fallback is ever added) and set a threshold (under 5 settlements) to switch to straight multiple choice in that case.

## Scoring System

### Categories and rewards
- Each of the three categories (country, capital, flag) can earn a **star** for a fully correct/high-confidence guess.
- Separately, **points** are earned based on speed and/or number of tries.
- Point weighting: **capital > flag > country name** (capital worth the most, country worth the least) — though flag it during build: without visible borders, country name may arguably be the hardest category, so weighting is worth a second look once playtested, and may end up capital > country > flag instead.

### Capital scoring (free text, no hints)

**Step 1 — Normalise both guess and answer:**
Lowercase, strip accents (é→e, ñ→n), strip cosmetic punctuation (periods, commas, apostrophes).

**Step 2 — Canonical spacing pass:**
Collapse hyphens to spaces, collapse multiple spaces to one, trim.
Examples: "Port-au-Prince" and "Port au Prince" both → "port au prince". "Washington D.C." and "Washington DC" both → "washington dc". This means differently-formatted-but-correct answers score 100, not a near-miss score.

**Step 3 — Similarity score:**
Compute Levenshtein distance between normalised guess and answer.
`similarity = 1 - (distance / max(length of guess, length of answer))`
`score = round(similarity * 100)`

**Step 4 — Floor and star threshold:**
- Below 60% similarity → score = 0 (treated as wrong, no partial credit for guesses that aren't recognisably close).
- 95% or above → counts as a full correct guess for star purposes.

**Known limitation to solve during build:** raw Levenshtein on short capital names (e.g. "Paris") is punishing — a single character swap on a 5-letter word is a 20% hit, so "pariis" and "pariz" both score 80 rather than the more forgiving ~95-98 originally wanted. Options to fix:
- Add a minimum-length floor to the denominator, e.g. `max(length, 6)` instead of raw length.
- Apply a curve to the raw score after calculation (e.g. square root of similarity, or a lookup curve).
Pick one, test against a handful of short and long capital names, and tune before finalising.

### Daily round count
7 rounds per day (5 felt too short, 10 too long — Wordle-style session length).

## Design Notes / Open Decisions
- Map: needs to be original (own tileset/rendering approach), not reused from maptag.gg or whereabouts.earth.
- Country dropdown: decide on full list source (ISO 3166 country list is a sensible base).
- Accent handling: currently stripped by default for capital scoring — confirm this is the desired behaviour vs. scoring accents as meaningful.
- Flag options: 10 choices per round, mix of plausible near-neighbours (same region/similar palette) vs random, to be decided for difficulty tuning.
- Scoring weight split between country/capital/flag: needs final numbers, not yet fixed.

## Initial Prompt to Start Building

```
Build the foundation for a daily geography guessing game (web app).

Round structure per country:
1. Guess country name (free text + dropdown, dropdown only shows after 3+ characters, no exact-match highlighting)
2. Guess capital name (free text, no hints, scored by Levenshtein-based string similarity — see scoring spec below)
3. Guess correct flag from 10 options (multiple choice)

Scoring for capital guesses:
- Normalise: lowercase, strip accents, strip cosmetic punctuation
- Canonicalise spacing: hyphens → spaces, collapse whitespace (so "Port-au-Prince" / "Port au Prince" / "Washington D.C." / "Washington DC" all normalise identically)
- Score = round((1 - levenshtein(guess, answer) / max(len(guess), len(answer))) * 100)
- Below 60% similarity = 0 (wrong)
- 95%+ = full star credit
- Apply a length-adjustment so short capital names aren't unfairly punished by single-character errors (e.g. minimum denominator floor of 6, or a curve) — implement and let me tune the constant

Each of the 3 categories earns a star on full/high-confidence correct guess. Separately track points based on speed/tries, weighted capital > flag > country (weighting is provisional, flag as configurable).

7 rounds per daily game.

Start by scaffolding:
- Data model for countries (name, capital, flag asset ref, coordinates for map scope)
- The scoring function (with unit tests covering short names, multi-word/hyphenated/punctuated capitals, and the 60%/95% thresholds)
- Basic round flow (country → capital → flag) with placeholder UI

Use whatever stack you'd recommend for a fast-loading, mobile-friendly daily web game — flag your stack choice before proceeding if there's a meaningful tradeoff.
```
